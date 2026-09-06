"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { one, run, nid } from "../db";
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
import { rateLimit, resetLimit, clientIp } from "../ratelimit";

/** Only ever redirect to a path on this site — blocks ?next=//evil.com */
function safeNext(v: string): string {
  const s = String(v || "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return "/dashboard";
  return s;
}

/** Rejects the passwords that actually get accounts taken over. */
function weakPassword(pw: string, email: string, name: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 200) return "Password is too long.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3)
    return "Use at least 3 of: lowercase, uppercase, a number and a symbol.";
  const low = pw.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length > 2 && low.includes(local)) return "Password must not contain your email.";
  if (name.length > 2 && low.includes(name.toLowerCase())) return "Password must not contain your name.";
  const common = ["password", "12345678", "qwerty", "letmein", "iloveyou", "admin123",
                  "welcome1", "abc12345", "111111", "g2x"];
  if (common.some((c) => low.includes(c))) return "That password is too common. Pick something unique.";
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
  const weak = weakPassword(password, email, name);
  if (weak) return { ok: false, error: weak };

  const existing = await one(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing)
    return { ok: false, error: "An account with this email already exists. Try logging in." };

  const id = nid("usr_");
  await run(
    `INSERT INTO users (id, name, email, password_hash, provider, role)
     VALUES (?,?,?,?,'email','buyer')`,
    [id, name, email, await bcrypt.hash(password, 12)]
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
      `INSERT INTO users (id, name, email, provider, role, country)
       VALUES (?,?,?,'google','buyer','India')`,
      [id, "Demo Buyer", email]
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

  await run(
    `UPDATE users SET name=?, phone=?, country=?, updated_at=datetime('now') WHERE id=?`,
    [name, phone || null, country || null, u.id]
  );
  return { ok: true };
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Not signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { ok: false, error: "New password must be 8+ characters." };
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
