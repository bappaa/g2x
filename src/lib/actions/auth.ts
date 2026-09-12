"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, run, nid, tx } from "../db";
import { createSession, destroySession, getSessionUser } from "../session";

const emailSchema = z.string().email().max(180);

export type ActionResult = { ok: boolean; error?: string; redirect?: string };

function clientMeta() {
  const h = headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: h.get("user-agent") ?? null,
  };
}

async function welcome(userId: string, name: string) {
  await run(
    `INSERT INTO notifications (id, user_id, title, body, href, kind)
     VALUES (?,?,?,?,?,?)`,
    [
      nid("ntf_"),
      userId,
      `Welcome to G2X.GG, ${name.split(" ")[0]}!`,
      "Your account is ready. Browse top-ups, accounts, currency and more.",
      "/",
      "system",
    ]
  );
}

import { mail } from "../mail";
import { SPEND_SQL, spendArgs } from "../wallet";
import {
  generateUsername, validateUsername, isUsernameFree, usernameChangeFee, FREE_CHANGES,
} from "../username";
import { rateLimit, resetLimit, clientIp } from "../ratelimit";

/** Only ever redirect to a path on this site — blocks ?next=//evil.com */
function safeNext(v: string): string {
  const s = String(v || "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return "/dashboard";
  return s;
}

/** Rejects the passwords that actually get accounts taken over. */
/**
 * Password policy — intentionally minimal.
 *
 * The old rules (8+ chars, 3 of 4 character classes, no name/email substring,
 * a common-password blocklist) rejected plenty of perfectly reasonable
 * passwords and cost sign-ups. The only hard requirements now are a 6
 * character minimum and no whitespace; anything else — letters, digits,
 * symbols, any mix — is accepted.
 *
 * Spaces are excluded because they are the single most common source of
 * "my password stopped working" reports (trailing space from copy-paste,
 * mobile keyboards auto-inserting one after autocomplete).
 */
const PASSWORD_MIN = 6;

function weakPassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > 200) return "Password is too long.";
  if (/\s/.test(pw)) return "Password cannot contain spaces.";
  return null;
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const ipR = clientIp(headers());
  const rl = await rateLimit(`register:${ipR}`, 5, 60 * 60);
  if (!rl.ok)
    return { ok: false, error: `Too many sign-ups from this network. Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.` };

  if (name.length < 2) return { ok: false, error: "Please enter your full name." };
  if (name.length > 80) return { ok: false, error: "That name is too long." };
  if (!emailSchema.safeParse(email).success)
    return { ok: false, error: "Enter a valid email address." };
  const weak = weakPassword(password);
  if (weak) return { ok: false, error: weak };

  const existing = await one(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing)
    return { ok: false, error: "An account with this email already exists. Try logging in." };

  const id = nid("usr_");
  // Every account gets a unique random handle (e.g. unicorn_256) it can rename later.
  const username = await generateUsername();
  await run(
    `INSERT INTO users (id, name, email, password_hash, provider, role, username)
     VALUES (?,?,?,?,'email','buyer',?)`,
    [id, name, email, await bcrypt.hash(password, 12), username]
  );
  await welcome(id, name);
  await mail.welcome(email, name);

  const { ip, ua } = clientMeta();
  await createSession(id, ip ?? undefined, ua ?? undefined);
  return { ok: true, redirect: safeNext(next) };
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!emailSchema.safeParse(email).success)
    return { ok: false, error: "Enter a valid email address." };

  // Two buckets: one stops a botnet hammering one account, the other stops a
  // single host spraying one password across many accounts.
  const ip = clientIp(headers());
  const ipKey = `login-ip:${ip}`;
  const acctKey = `login-acct:${email}`;
  const [ipL, acctL] = await Promise.all([
    rateLimit(ipKey, 20, 15 * 60),
    rateLimit(acctKey, 6, 15 * 60),
  ]);
  if (!ipL.ok || !acctL.ok) {
    const wait = Math.ceil(Math.max(ipL.retryAfter, acctL.retryAfter) / 60);
    return { ok: false, error: `Too many failed attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  }

  const user = await one<{ id: string; password_hash: string | null; status: string }>(
    `SELECT id, password_hash, status FROM users WHERE email = ?`,
    [email]
  );

  // constant-ish time: always run a hash comparison
  const hash = user?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO";
  const good = await bcrypt.compare(password, hash);

  if (!user || !user.password_hash || !good)
    return { ok: false, error: "Incorrect email or password." };
  if (user.status === "banned")
    return { ok: false, error: "This account has been suspended. Contact support." };

  // success — don't hold the counter against a legitimate user
  await Promise.all([resetLimit(ipKey), resetLimit(acctKey)]);

  const meta = clientMeta();
  await createSession(user.id, meta.ip ?? undefined, meta.ua ?? undefined);
  return { ok: true, redirect: safeNext(next) };
}

/**
 * Google sign-in.
 * If GOOGLE_CLIENT_ID/SECRET are configured the /api/auth/google route
 * performs a real OAuth 2.0 code flow. This action is the fallback used
 * when the app runs without Google credentials (demo mode).
 */
export async function demoGoogleAction(next = "/dashboard"): Promise<ActionResult> {
  if (process.env.GOOGLE_CLIENT_ID)
    return { ok: false, error: "Use the OAuth route." };

  const email = "demo.buyer@gmail.com";
  let user = await one<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [email]);
  if (!user) {
    const id = nid("usr_");
    await run(
      `INSERT INTO users (id, name, email, provider, role, country, username)
       VALUES (?,?,?,'google','buyer','',?)`,
      [id, "Demo Buyer", email, await generateUsername()]
    );
    await welcome(id, "Demo Buyer");
    user = { id };
  }
  const { ip, ua } = clientMeta();
  await createSession(user.id, ip ?? undefined, ua ?? undefined);
  return { ok: true, redirect: next };
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Name is too short." };

  /**
   * Profile photo.
   *
   * Stored as a data URI on the user row rather than on disk: the app has to
   * run unchanged on a host with no writable filesystem, and an avatar is
   * small enough that the row cost is irrelevant. 1 MB keeps the payload sane
   * — the client downscales before uploading, so this is only a backstop.
   */
  const avatarFile = formData.get("avatarFile");
  let avatar: string | null = null;

  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (avatarFile.size > 1024 * 1024)
      return { ok: false, error: "Profile photo must be 1 MB or smaller." };

    const type = (avatarFile.type || "").toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(type))
      return { ok: false, error: "Profile photo must be a PNG, JPEG or WEBP image." };

    const buf = Buffer.from(await avatarFile.arrayBuffer());
    avatar = `data:${type};base64,${buf.toString("base64")}`;
  }

  // An explicit "remove" wins over everything else.
  const clearAvatar = String(formData.get("removeAvatar") ?? "") === "1";

  if (clearAvatar) {
    await run(
      `UPDATE users SET name=?, phone=?, country=?, avatar=NULL, updated_at=datetime('now') WHERE id=?`,
      [name, phone || null, country || null, u.id]
    );
  } else if (avatar) {
    await run(
      `UPDATE users SET name=?, phone=?, country=?, avatar=?, updated_at=datetime('now') WHERE id=?`,
      [name, phone || null, country || null, avatar, u.id]
    );
  } else {
    await run(
      `UPDATE users SET name=?, phone=?, country=?, updated_at=datetime('now') WHERE id=?`,
      [name, phone || null, country || null, u.id]
    );
  }

  // The avatar shows in the header on every page, so refresh the whole shell.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Rename the public handle.
 *
 * The first two changes are free. Beyond that the account is charged a fee set
 * by the admin (`username_change_fee`) and debited from the wallet balance.
 * The debit, the rename and the counter increment all run in ONE transaction,
 * so a failure can never take the money without applying the change, nor apply
 * the change without taking the money.
 *
 * Uniqueness is checked up front for a friendly message, and enforced again by
 * a UNIQUE index to close the race between two people claiming the same handle
 * at the same moment.
 */
export async function changeUsernameAction(raw: string): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Not signed in." };

  const wanted = String(raw ?? "").trim();
  const shapeError = validateUsername(wanted);
  if (shapeError) return { ok: false, error: shapeError };

  const row = await one<{ username: string | null; username_changes: number; balance: number }>(
    `SELECT username, username_changes, balance FROM users WHERE id=?`,
    [u.id]
  );
  const current = row?.username ?? "";
  if (current.toLowerCase() === wanted.toLowerCase())
    return { ok: false, error: "That is already your username." };

  if (!(await isUsernameFree(wanted, u.id)))
    return { ok: false, error: "That username is already taken. Try another one." };

  const used = Number(row?.username_changes ?? 0);
  const fee = used >= FREE_CHANGES ? await usernameChangeFee() : 0;
  const balance = Number(row?.balance ?? 0);

  if (fee > 0 && balance < fee)
    return {
      ok: false,
      error: `Changing your username costs $${fee.toFixed(2)}. Your wallet balance is $${balance.toFixed(2)} — please top up first.`,
    };

  const stmts: { sql: string; args: unknown[] }[] = [
    {
      sql: `UPDATE users SET username=?, username_changes=username_changes+1,
                             updated_at=datetime('now')
             WHERE id=?`,
      args: [wanted, u.id],
    },
  ];

  if (fee > 0) {
    stmts.push({
      sql: SPEND_SQL,
      args: spendArgs(fee, u.id),
    });
    stmts.push({
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference)
            VALUES (?,?, 'fee', ?, ?)`,
      args: [nid("txn_"), u.id, -fee, `Username change to @${wanted}`],
    });
  }

  try {
    await tx(stmts as never);
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (/UNIQUE|constraint/i.test(msg))
      return { ok: false, error: "That username was just taken. Try another one." };
    throw e;
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Not signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const weakNext = weakPassword(next);
  if (weakNext) return { ok: false, error: weakNext };
  if (next !== confirm) return { ok: false, error: "New passwords do not match." };

  const row = await one<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id=?`,
    [u.id]
  );
  if (row?.password_hash && !(await bcrypt.compare(current, row.password_hash)))
    return { ok: false, error: "Current password is incorrect." };

  await run(`UPDATE users SET password_hash=? WHERE id=?`, [
    await bcrypt.hash(next, 12),
    u.id,
  ]);
  return { ok: true };
}

export async function toggle2faAction(on: boolean): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Not signed in." };
  await run(`UPDATE users SET two_factor=? WHERE id=?`, [on ? 1 : 0, u.id]);
  return { ok: true };
}

export async function revokeSessionAction(id: string): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Not signed in." };
  await run(`DELETE FROM sessions WHERE id=? AND user_id=?`, [id, u.id]);
  return { ok: true };
}
