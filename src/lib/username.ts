import "server-only";
import { one, run } from "./db";

/**
 * PUBLIC USERNAMES
 * ================
 * Every account gets a random handle at sign-up (e.g. `unicorn_256`). It is
 * unique across the marketplace and is what other users see.
 *
 * Rules (kept deliberately simple and permissive):
 *  - 5–15 characters
 *  - letters, digits and underscore only — never a space
 *  - case-insensitive for uniqueness, so `Aman` and `aman` cannot coexist
 *
 * Renames: the first `FREE_CHANGES` are free. After that the account must pay
 * a fee whose amount is set by the admin (`username_change_fee`), charged
 * against the wallet balance. Only the admin controls the price.
 */

export const USERNAME_MIN = 5;
export const USERNAME_MAX = 15;
export const FREE_CHANGES = 2;

/** Reserved handles that would be confusing or impersonate the platform. */
const RESERVED = new Set([
  "admin", "administrator", "support", "g2x", "g2xgg", "moderator", "mod",
  "staff", "system", "root", "help", "billing", "security", "official",
  "noreply", "no_reply", "seller", "buyer", "team",
]);

const WORDS = [
  "unicorn", "falcon", "shadow", "phoenix", "dragon", "tiger", "wolf", "raven",
  "cobra", "viper", "nova", "comet", "ember", "frost", "storm", "blaze",
  "ninja", "wizard", "knight", "ranger", "hunter", "sniper", "rogue", "titan",
  "pixel", "turbo", "cyber", "neon", "quantum", "atomic", "cosmic", "hyper",
  "lucky", "swift", "silent", "mighty", "royal", "epic", "prime", "apex",
];

/**
 * Why a shape check returns a message rather than a boolean: the same copy is
 * shown in the UI, so keeping it here means the client and server can never
 * disagree about why a handle was refused.
 */
export function validateUsername(raw: string): string | null {
  const u = raw.trim();
  if (!u) return "Choose a username.";
  if (/\s/.test(u)) return "Usernames cannot contain spaces.";
  if (u.length < USERNAME_MIN) return `Usernames must be at least ${USERNAME_MIN} characters.`;
  if (u.length > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;
  if (!/^[A-Za-z0-9_]+$/.test(u))
    return "Use only letters, numbers and underscores — no spaces or symbols.";
  if (RESERVED.has(u.toLowerCase())) return "That username is reserved.";
  return null;
}

/** Case-insensitive availability check, optionally ignoring one user's own handle. */
export async function isUsernameFree(name: string, exceptUserId?: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
    [name.trim()]
  );
  if (!row) return true;
  return !!exceptUserId && row.id === exceptUserId;
}

/**
 * Builds a random handle and guarantees it is free.
 *
 * Uniqueness is ultimately enforced by a UNIQUE index; this loop just avoids
 * losing the race in the common case. After a few tries it widens the random
 * suffix so the pool never runs dry.
 */
export async function generateUsername(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const digits = attempt < 6 ? 3 : 5;
    const max = 10 ** digits;
    const num = Math.floor(Math.random() * max)
      .toString()
      .padStart(digits, "0");

    let candidate = `${word}_${num}`;
    if (candidate.length > USERNAME_MAX) candidate = candidate.slice(0, USERNAME_MAX);

    if (validateUsername(candidate)) continue;
    if (await isUsernameFree(candidate)) return candidate;
  }
  // Deterministic fallback — still within the length and charset rules.
  return `user_${Date.now().toString(36).slice(-8)}`.slice(0, USERNAME_MAX);
}

/** Admin-set price for a rename beyond the free allowance. 0 = always free. */
export async function usernameChangeFee(): Promise<number> {
  const r = await one<{ value: string }>(
    `SELECT value FROM settings WHERE key='username_change_fee'`
  );
  const n = Number(r?.value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Backfills a handle for accounts created before usernames existed, so older
 * users (and the seeded demo accounts) are never left without one.
 */
export async function ensureUsername(userId: string): Promise<string | null> {
  try {
    const row = await one<{ username: string | null }>(
      `SELECT username FROM users WHERE id=?`,
      [userId]
    );
    if (row?.username) return row.username;

    const name = await generateUsername();
    await run(`UPDATE users SET username=? WHERE id=? AND username IS NULL`, [name, userId]);
    return name;
  } catch {
    return null;
  }
}
