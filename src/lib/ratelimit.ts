import "server-only";
import { run, one } from "./db";

/**
 * Durable rate limiter.
 *
 * Counters live in SQLite rather than process memory so the limit holds across
 * serverless invocations and multiple instances — an in-memory Map would reset
 * on every cold start, which is exactly what a credential-stuffing script waits
 * for. Rows are cheap and swept opportunistically.
 */

let ready = false;
async function ensure() {
  if (ready) return;
  await run(`CREATE TABLE IF NOT EXISTS rate_limits (
    bucket    TEXT PRIMARY KEY,
    hits      INTEGER NOT NULL DEFAULT 0,
    reset_at  INTEGER NOT NULL
  )`);
  ready = true;
}

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

/**
 * @param key     identifies the actor+action, e.g. `login:1.2.3.4`
 * @param limit   max hits allowed inside the window
 * @param windowS window length in seconds
 */
export async function rateLimit(key: string, limit: number, windowS: number): Promise<RateResult> {
  await ensure();
  const now = Math.floor(Date.now() / 1000);

  const row = await one<{ hits: number; reset_at: number }>(
    `SELECT hits, reset_at FROM rate_limits WHERE bucket=?`,
    [key]
  );

  if (!row || row.reset_at <= now) {
    await run(
      `INSERT INTO rate_limits (bucket,hits,reset_at) VALUES (?,1,?)
       ON CONFLICT(bucket) DO UPDATE SET hits=1, reset_at=excluded.reset_at`,
      [key, now + windowS]
    );
    // opportunistic sweep, ~2% of calls
    if (Math.random() < 0.02) await run(`DELETE FROM rate_limits WHERE reset_at < ?`, [now]);
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (row.hits >= limit)
    return { ok: false, remaining: 0, retryAfter: row.reset_at - now };

  await run(`UPDATE rate_limits SET hits = hits + 1 WHERE bucket=?`, [key]);
  return { ok: true, remaining: limit - row.hits - 1, retryAfter: 0 };
}

/** Clears a bucket — call after a successful login so good users aren't punished. */
export async function resetLimit(key: string) {
  await ensure();
  await run(`DELETE FROM rate_limits WHERE bucket=?`, [key]);
}

/** Best-effort client IP from the proxy headers Vercel/Cloudflare set. */
export function clientIp(h: Headers): string {
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown"
  );
}
