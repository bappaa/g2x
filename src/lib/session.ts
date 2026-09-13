import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { all, one, run, nid } from "./db";

const COOKIE = "g2x_session";
const DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production")
      throw new Error("AUTH_SECRET must be set (32+ random chars) in production");
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-please");
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  name: string;
  /** Public handle. This — never the legal name — is what other users see. */
  username: string | null;
  email: string;
  avatar: string | null;
  role: "buyer" | "seller" | "admin";
  isSeller: boolean;
  status: string;
  balance: number;
  provider: string;
  country: string | null;
  phone: string | null;
  twoFactor: boolean;
  createdAt: string;
  sellerStatus?: string | null;
  storeName?: string | null;
};

export async function createSession(userId: string, ip?: string, ua?: string) {
  const sid = nid("ses_");
  const expires = new Date(Date.now() + DAYS * 864e5);

  await run(
    `INSERT INTO sessions (id, user_id, ip, user_agent, expires_at) VALUES (?,?,?,?,?)`,
    [sid, userId, ip ?? null, ua ?? null, expires.toISOString()]
  );

  const token = await new SignJWT({ sid, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  return sid;
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      await run(`DELETE FROM sessions WHERE id = ?`, [String(payload.sid)]);
    } catch {}
  }
  cookies().delete(COOKIE);
}

type Row = Record<string, unknown>;

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;

  let sid: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    sid = String(payload.sid);
  } catch {
    return null;
  }

  const row = await one<Row>(
    `SELECT u.*, s.expires_at AS s_exp, sp.status AS seller_status, sp.store_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN seller_profiles sp ON sp.user_id = u.id
      WHERE s.id = ?`,
    [sid]
  );
  if (!row) return null;
  if (new Date(String(row.s_exp)).getTime() < Date.now()) {
    await run(`DELETE FROM sessions WHERE id = ?`, [sid]);
    return null;
  }
  if (row.status === "banned") return null;

  return {
    id: String(row.id),
    name: String(row.name),
    username: (row.username as string) ?? null,
    email: String(row.email),
    avatar: (row.avatar as string) ?? null,
    role: row.role as SessionUser["role"],
    isSeller: Number(row.is_seller) === 1,
    status: String(row.status),
    balance: Number(row.balance),
    provider: String(row.provider),
    country: (row.country as string) ?? null,
    phone: (row.phone as string) ?? null,
    twoFactor: Number(row.two_factor) === 1,
    createdAt: String(row.created_at),
    sellerStatus: (row.seller_status as string) ?? null,
    storeName: (row.store_name as string) ?? null,
  };
}

/**
 * Session or bust.
 *
 * A stale cookie (session row expired, or the DB was reseeded) still passes the
 * middleware's cheap "cookie exists?" check, so this can legitimately find no
 * user. Throwing here surfaced as a red error overlay; redirecting to the login
 * page with a `next` hint is what the visitor actually wants. The expired
 * cookie is cleared on the way out so the loop can't repeat.
 */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) {
    let next = "/dashboard";
    try {
      const h = headers();
      next = h.get("x-invoke-path") || h.get("x-pathname") || next;
    } catch {}
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return u;
}

export async function requireSeller(): Promise<SessionUser> {
  const u = await requireUser();
  if (!u.isSeller || u.sellerStatus !== "active") redirect("/dashboard/become-seller");
  return u;
}

export async function listSessions(userId: string) {
  return all(
    `SELECT id, ip, user_agent, created_at, expires_at FROM sessions
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
    [userId]
  );
}
