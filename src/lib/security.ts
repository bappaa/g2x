/**
 * HIGH-LEVEL SECURITY FOR G2X.GG
 * Gaming ecommerce is heavily targeted - this module adds defense in depth
 * without lagging the site. All checks are fast, in-memory or single SQLite query.
 */

import { all, one, run, nid } from "./db";
import { rateLimit } from "./ratelimit";
import { containsXSS, containsSQLi } from "./sanitize";

/* ==================================================================== */
/* BOT & EXPLOIT DETECTION                                              */
/* ==================================================================== */

const BAD_UA_PATTERNS = [
  /sqlmap/i, /nmap/i, /nikto/i, /dirbuster/i, /gobuster/i,
  /masscan/i, /zap/i, /burpsuite/i, /acunetix/i, /nessus/i,
  /havij/i, /wpscan/i, /metasploit/i, /hydra/i,
  /curl/i, /wget/i, /python-requests/i, /go-http-client/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i,
];

const BAD_PATH_EXTRA =
  /(?:\b(?:union\s+select|or\s+1=1|drop\s+table|insert\s+into|xp_cmdshell)\b|\.\.\/|\.\.\\)/i;

export function isSuspiciousUA(ua: string): boolean {
  if (!ua || ua.length < 10) return true; // Empty UA = bot
  return BAD_UA_PATTERNS.some((re) => re.test(ua));
}

export function isSuspiciousPath(path: string): boolean {
  return BAD_PATH_EXTRA.test(path);
}

/* ==================================================================== */
/* IP BLOCKLIST & REPUTATION                                            */
/* ==================================================================== */

let blocklistCache: Set<string> | null = null;
let blocklistCacheTime = 0;

async function getBlocklist(): Promise<Set<string>> {
  const now = Date.now();
  if (blocklistCache && now - blocklistCacheTime < 60_000) return blocklistCache;
  try {
    const rows = await all<{ ip: string }>(`SELECT ip FROM ip_blocks WHERE expires_at > datetime('now') LIMIT 1000`);
    blocklistCache = new Set(rows.map((r) => r.ip));
    blocklistCacheTime = now;
    return blocklistCache;
  } catch {
    // Table may not exist yet
    return new Set();
  }
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  const list = await getBlocklist();
  return list.has(ip);
}

export async function blockIp(ip: string, reason: string, hours = 24): Promise<void> {
  try {
    await run(
      `INSERT INTO ip_blocks (id, ip, reason, expires_at) VALUES (?,?,?, datetime('now', '+${Math.floor(hours)} hours'))
       ON CONFLICT(ip) DO UPDATE SET reason=excluded.reason, expires_at=excluded.expires_at`,
      [nid("blk_"), ip, reason.slice(0, 200)]
    );
    blocklistCache = null; // Invalidate cache
  } catch {
    // Table may not exist - create it
    try {
      await run(`CREATE TABLE IF NOT EXISTS ip_blocks (
        id TEXT PRIMARY KEY, ip TEXT UNIQUE, reason TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT
      )`);
      await run(`INSERT OR REPLACE INTO ip_blocks (id, ip, reason, expires_at) VALUES (?,?,?, datetime('now', '+${Math.floor(hours)} hours'))`, [nid("blk_"), ip, reason.slice(0, 200)]);
    } catch {}
  }
}

/* ==================================================================== */
/* SECURITY EVENT LOGGING                                               */
/* ==================================================================== */

export async function logSecurityEvent(
  ip: string,
  event: string,
  detail: string,
  severity: "low" | "medium" | "high" | "critical" = "medium"
): Promise<void> {
  try {
    await run(
      `INSERT INTO security_logs (id, ip, event, detail, severity) VALUES (?,?,?,?,?)`,
      [nid("sec_"), ip.slice(0, 45), event.slice(0, 100), detail.slice(0, 500), severity]
    );
  } catch {
    try {
      await run(`CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY, ip TEXT, event TEXT, detail TEXT, severity TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      await run(`INSERT INTO security_logs (id, ip, event, detail, severity) VALUES (?,?,?,?,?)`, [nid("sec_"), ip.slice(0, 45), event.slice(0, 100), detail.slice(0, 500), severity]);
    } catch {}
  }
}

/* ==================================================================== */
/* INPUT VALIDATION FOR ALL FORMS                                       */
/* ==================================================================== */

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateGameInput(data: { name: string; slug: string; logo: string }): ValidationResult {
  if (!data.name || data.name.trim().length < 2) return { ok: false, error: "Game name must be at least 2 characters" };
  if (data.name.length > 80) return { ok: false, error: "Game name too long (max 80)" };
  if (containsXSS(data.name) || containsSQLi(data.name)) return { ok: false, error: "Invalid characters in game name" };
  
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) return { ok: false, error: "Slug must be lowercase letters, numbers, hyphens only" };
  if (data.slug && data.slug.length > 60) return { ok: false, error: "Slug too long" };
  
  // Logo is required now
  if (!data.logo || !data.logo.trim()) return { ok: false, error: "Game logo is required - upload an image for homepage display" };
  if (data.logo.length > 500) return { ok: false, error: "Logo URL too long" };
  
  return { ok: true };
}

export function validateProductInput(data: { name: string; game: string; category: string; image: string; price: number }): ValidationResult {
  if (!data.name || data.name.trim().length < 2) return { ok: false, error: "Product name must be at least 2 characters" };
  if (data.name.length > 120) return { ok: false, error: "Product name too long" };
  if (containsXSS(data.name) || containsSQLi(data.name)) return { ok: false, error: "Invalid characters in product name" };
  
  if (!data.game) return { ok: false, error: "Game is required" };
  if (!data.category) return { ok: false, error: "Category is required" };
  
  // Image is required for currency/top-up display
  if (!data.image || !data.image.trim()) return { ok: false, error: "Product image is required - this shows on game page categories" };
  if (data.image.length > 500) return { ok: false, error: "Image URL too long" };
  
  if (!Number.isFinite(data.price) || data.price <= 0) return { ok: false, error: "Price must be greater than 0" };
  if (data.price > 100000) return { ok: false, error: "Price too high" };
  
  return { ok: true };
}

/* ==================================================================== */
/* ENHANCED RATE LIMITING FOR SENSITIVE ACTIONS                         */
/* ==================================================================== */

export async function checkRateLimit(
  key: string,
  limit: number,
  windowS: number
): Promise<{ ok: boolean; retryAfter: number }> {
  const result = await rateLimit(key, limit, windowS);
  return { ok: result.ok, retryAfter: result.retryAfter };
}

/** Check if request should be blocked due to suspicious activity */
export async function shouldBlockRequest(req: { ip: string; ua: string; path: string }): Promise<{ block: boolean; reason?: string }> {
  // Check IP blocklist
  if (await isIpBlocked(req.ip)) {
    return { block: true, reason: "IP blocked" };
  }
  
  // Check suspicious UA
  if (isSuspiciousUA(req.ua) && req.path.includes("/api/")) {
    // Allow curl for health checks but block exploit tools on sensitive paths
    if (/(sqlmap|nmap|nikto|havij)/i.test(req.ua)) {
      return { block: true, reason: "Exploit tool detected" };
    }
  }
  
  // Check suspicious path
  if (isSuspiciousPath(req.path)) {
    return { block: true, reason: "Suspicious path" };
  }
  
  return { block: false };
}

/* ==================================================================== */
/* SECURE HEADERS HELPER                                                */
/* ==================================================================== */

export function getSecurityHeaders(isProd: boolean): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), clipboard-read=(), clipboard-write=(self)",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...(isProd ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" } : {}),
  };
}

/* ==================================================================== */
/* HONEYPOT & BOT PROTECTION                                            */
/* ==================================================================== */

export function checkHoneypot(formData: FormData): boolean {
  // Hidden field that bots fill but humans don't
  const honeypot = String(formData.get("_hp") ?? formData.get("website") ?? "").trim();
  return honeypot.length > 0; // If filled, it's a bot
}

/** Validate request timing - too fast = bot */
export function checkTiming(startTime: number, minMs = 800): boolean {
  const elapsed = Date.now() - startTime;
  return elapsed < minMs; // Too fast = bot
}

/* ==================================================================== */
/* WALLET & PAYMENT SECURITY                                            */
/* ==================================================================== */

export function validateWalletAmount(amount: number): ValidationResult {
  if (!Number.isFinite(amount)) return { ok: false, error: "Invalid amount" };
  if (amount <= 0) return { ok: false, error: "Amount must be positive" };
  if (amount > 100000) return { ok: false, error: "Amount too large" };
  // Check for decimal manipulation - max 2 decimals
  if (Math.round(amount * 100) !== amount * 100) return { ok: false, error: "Invalid amount format" };
  return { ok: true };
}

/** Ensure user can't tamper with price - verify against DB */
export async function verifyOfferPrice(offerId: string, expectedPrice: number): Promise<boolean> {
  try {
    const offer = await one<{ price: number }>(`SELECT price FROM offers WHERE id=?`, [offerId]);
    if (!offer) return false;
    // Allow small floating point difference
    return Math.abs(Number(offer.price) - expectedPrice) < 0.01;
  } catch {
    return false;
  }
}

/* ==================================================================== */
/* ADMIN SECURITY                                                       */
/* ==================================================================== */

export async function checkAdminRateLimit(adminId: string, action: string): Promise<{ ok: boolean; retryAfter: number }> {
  // Stricter limits for admin actions
  const limits: Record<string, { limit: number; window: number }> = {
    "game.create": { limit: 20, window: 60 * 5 },
    "product.create": { limit: 50, window: 60 * 5 },
    "media.upload": { limit: 30, window: 60 * 5 },
    "user.ban": { limit: 10, window: 60 * 10 },
    "default": { limit: 100, window: 60 * 5 },
  };
  const config = limits[action] ?? limits.default;
  return checkRateLimit(`admin:${adminId}:${action}`, config.limit, config.window);
}
