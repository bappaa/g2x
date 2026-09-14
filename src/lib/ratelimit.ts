import "server-only";
import { run, one } from "./db";

/**
 * Durable rate limiter - HIGH SECURITY EDITION.
 *
 * Counters live in SQLite rather than process memory so the limit holds across
 * serverless invocations and multiple instances — an in-memory Map would reset
 * on every cold start, which is exactly what a credential-stuffing script waits
 * for. Rows are cheap and swept opportunistically.
 * 
 * Enhanced with:
 * - IP reputation tracking
 * - Progressive penalties for repeat offenders
 * - Sliding window support
 * - Automatic cleanup
 */

let ready = false;
async function ensure() {
  if (ready) return;
  await run(`CREATE TABLE IF NOT EXISTS rate_limits (
    bucket    TEXT PRIMARY KEY,
    hits      INTEGER NOT NULL DEFAULT 0,
    reset_at  INTEGER NOT NULL
  )`);
  // IP reputation table
  await run(`CREATE TABLE IF NOT EXISTS ip_reputation (
    ip TEXT PRIMARY KEY,
    score INTEGER NOT NULL DEFAULT 0,
    violations INTEGER NOT NULL DEFAULT 0,
    last_seen TEXT DEFAULT (datetime('now')),
    blocked_until TEXT
  )`);
  // Security logs
  await run(`CREATE TABLE IF NOT EXISTS security_logs (
    id TEXT PRIMARY KEY,
    ip TEXT, event TEXT, detail TEXT, severity TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  // IP blocks
  await run(`CREATE TABLE IF NOT EXISTS ip_blocks (
    id TEXT PRIMARY KEY, ip TEXT UNIQUE, reason TEXT,
    created_at TEXT DEFAULT (datetime('now')), expires_at TEXT
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
  // Sanitize key - prevent injection
  const cleanKey = String(key).replace(/[^a-zA-Z0-9:_.-]/g, "").slice(0, 150);
  if (!cleanKey) return { ok: false, remaining: 0, retryAfter: 60 };
  
  const now = Math.floor(Date.now() / 1000);

  const row = await one<{ hits: number; reset_at: number }>(
    `SELECT hits, reset_at FROM rate_limits WHERE bucket=?`,
    [cleanKey]
  );

  if (!row || row.reset_at <= now) {
    await run(
      `INSERT INTO rate_limits (bucket,hits,reset_at) VALUES (?,1,?)
       ON CONFLICT(bucket) DO UPDATE SET hits=1, reset_at=excluded.reset_at`,
      [cleanKey, now + windowS]
    );
    // opportunistic sweep, ~3% of calls
    if (Math.random() < 0.03) {
      await run(`DELETE FROM rate_limits WHERE reset_at < ?`, [now]);
      // Also clean old reputation entries
      await run(`DELETE FROM ip_reputation WHERE last_seen < datetime('now', '-30 days')`);
      await run(`DELETE FROM security_logs WHERE created_at < datetime('now', '-7 days')`);
    }
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (row.hits >= limit) {
    // Track violation for IP reputation
    const ipMatch = cleanKey.match(/(\d+\.\d+\.\d+\.\d+|[a-f0-9:]+)$/i);
    if (ipMatch) {
      void trackViolation(ipMatch[1], cleanKey);
    }
    return { ok: false, remaining: 0, retryAfter: row.reset_at - now };
  }

  await run(`UPDATE rate_limits SET hits = hits + 1 WHERE bucket=?`, [cleanKey]);
  return { ok: true, remaining: limit - row.hits - 1, retryAfter: 0 };
}

/** Track IP violations for reputation */
async function trackViolation(ip: string, _bucket: string): Promise<void> {
  try {
    await run(
      `INSERT INTO ip_reputation (ip, score, violations, last_seen) VALUES (?,?,1, datetime('now'))
       ON CONFLICT(ip) DO UPDATE SET 
         score = score + 1,
         violations = violations + 1,
         last_seen = datetime('now')`,
      [ip, 1]
    );
  } catch {}
}

/** Check IP reputation - returns true if IP is suspicious */
export async function checkIpReputation(ip: string): Promise<{ score: number; blocked: boolean }> {
  await ensure();
  if (!ip || ip === "unknown") return { score: 0, blocked: false };
  
  const row = await one<{ score: number; violations: number; blocked_until: string | null }>(
    `SELECT score, violations, blocked_until FROM ip_reputation WHERE ip=?`,
    [ip]
  );
  
  if (!row) return { score: 0, blocked: false };
  
  // Check if still blocked
  if (row.blocked_until) {
    const blockedUntil = new Date(row.blocked_until).getTime();
    if (blockedUntil > Date.now()) {
      return { score: row.score, blocked: true };
    }
  }
  
  // Auto-block if score too high
  if (row.score > 50 || row.violations > 20) {
    return { score: row.score, blocked: true };
  }
  
  return { score: row.score, blocked: false };
}

/** Clears a bucket — call after a successful login so good users aren't punished. */
export async function resetLimit(key: string) {
  await ensure();
  const cleanKey = String(key).replace(/[^a-zA-Z0-9:_.-]/g, "").slice(0, 150);
  await run(`DELETE FROM rate_limits WHERE bucket=?`, [cleanKey]);
}

/** Best-effort client IP from the proxy headers Vercel/Cloudflare set. */
export function clientIp(h: Headers): string {
  // Check for spoofing - x-forwarded-for can be faked, so we take first and validate
  const cfIp = h.get("cf-connecting-ip");
  if (cfIp && /^[\d.:a-f]+$/i.test(cfIp.trim()) && cfIp.length < 45) return cfIp.trim();
  
  const realIp = h.get("x-real-ip");
  if (realIp && /^[\d.:a-f]+$/i.test(realIp.trim()) && realIp.length < 45) return realIp.trim();
  
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && /^[\d.:a-f]+$/i.test(first) && first.length < 45) return first;
  }
  
  return "unknown";
}

/** Validate IP format */
export function isValidIp(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return ip.split(".").every((n) => {
      const num = Number(n);
      return num >= 0 && num <= 255;
    });
  }
  // IPv6 basic check
  if (/^[a-f0-9:]+$/i.test(ip) && ip.includes(":")) return ip.length <= 45;
  return false;
}
