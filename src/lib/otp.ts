import "server-only";
import { createHash, randomInt } from "node:crypto";
import { one, run, nid } from "./db";
import { mail } from "./mail";

/**
 * EMAIL VERIFICATION (OTP)
 * ========================
 * Anyone could previously register with an address they did not own, which
 * matters on a marketplace: order confirmations, delivered credentials and
 * password resets all go to that inbox.
 *
 * A 6-digit code is emailed on signup and must be entered before the account
 * can be used. Design notes:
 *
 *  - codes are stored **hashed**, never in plain text, so a database leak does
 *    not hand out live codes;
 *  - 10-minute expiry and a 5-attempt cap stop brute force (a 6-digit code is
 *    only a million combinations);
 *  - requesting a new code invalidates the previous one, so an old email
 *    cannot be replayed;
 *  - resend is rate-limited to once every 60 seconds.
 */

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

/** Cryptographically random 6-digit code (never `Math.random`). */
const generate = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export type OtpResult = { ok: boolean; error?: string; retryIn?: number };

/**
 * Issue a fresh code and email it.
 * Any earlier unconsumed code for the same purpose is invalidated first.
 */
export async function sendOtp(
  userId: string,
  email: string,
  purpose: "verify" | "reset" = "verify"
): Promise<OtpResult> {
  // Cooldown — stop someone hammering the resend button (or our mail quota).
  const recent = await one<{ created_at: string }>(
    `SELECT created_at FROM email_otps
      WHERE user_id=? AND purpose=? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  ).catch(() => null);

  if (recent?.created_at) {
    const age = Date.now() - new Date(recent.created_at.replace(" ", "T") + "Z").getTime();
    if (age >= 0 && age < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "Please wait a moment before requesting another code.",
        retryIn: Math.ceil((RESEND_COOLDOWN_MS - age) / 1000),
      };
    }
  }

  const code = generate();

  await run(
    `UPDATE email_otps SET consumed_at=datetime('now')
      WHERE user_id=? AND purpose=? AND consumed_at IS NULL`,
    [userId, purpose]
  );

  await run(
    `INSERT INTO email_otps (id,user_id,email,code_hash,purpose,expires_at)
     VALUES (?,?,?,?,?, datetime('now', ?))`,
    [nid("otp_"), userId, email, hash(code), purpose, `+${TTL_MINUTES} minutes`]
  );

  await mail.otp(
    email,
    code,
    purpose === "verify" ? "verify your email" : "reset your password"
  );

  return { ok: true };
}

/**
 * Check a code. Marks the account verified on success.
 * Wrong codes burn an attempt so the code cannot be guessed.
 */
export async function verifyOtp(
  userId: string,
  code: string,
  purpose: "verify" | "reset" = "verify"
): Promise<OtpResult> {
  const clean = code.replace(/\D/g, "").slice(0, 6);
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };

  const row = await one<{ id: string; code_hash: string; attempts: number; expires_at: string }>(
    `SELECT id, code_hash, attempts, expires_at FROM email_otps
      WHERE user_id=? AND purpose=? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  );

  if (!row) return { ok: false, error: "That code has expired. Request a new one." };

  if (new Date(row.expires_at.replace(" ", "T") + "Z").getTime() < Date.now()) {
    await run(`UPDATE email_otps SET consumed_at=datetime('now') WHERE id=?`, [row.id]);
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await run(`UPDATE email_otps SET consumed_at=datetime('now') WHERE id=?`, [row.id]);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  if (row.code_hash !== hash(clean)) {
    await run(`UPDATE email_otps SET attempts=attempts+1 WHERE id=?`, [row.id]);
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      error: left > 0 ? `Incorrect code — ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many attempts. Request a new code.",
    };
  }

  await run(`UPDATE email_otps SET consumed_at=datetime('now') WHERE id=?`, [row.id]);
  if (purpose === "verify") {
    await run(`UPDATE users SET email_verified=1 WHERE id=?`, [userId]);
  }
  return { ok: true };
}

/** Has this account confirmed its email? */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const u = await one<{ email_verified: number }>(
      `SELECT email_verified FROM users WHERE id=?`,
      [userId]
    );
    return Number(u?.email_verified ?? 0) === 1;
  } catch {
    // Column missing on an un-migrated database — never lock anyone out.
    return true;
  }
}

/** Housekeeping: drop codes that are long dead. */
export async function purgeExpiredOtps(): Promise<number> {
  try {
    const r = await run(
      `DELETE FROM email_otps
        WHERE datetime(expires_at) < datetime('now', '-1 day')`
    );
    return Number(r?.rowsAffected ?? 0);
  } catch {
    return 0;
  }
}
