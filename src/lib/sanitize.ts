/**
 * SANITIZATION & SECURITY HELPERS
 * High-level protection for gaming ecommerce - prevents XSS, injection, etc.
 * Zero dependencies, no lag, pure functions.
 */

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/** Escape HTML to prevent XSS */
export function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"'/]/g, (c) => HTML_ESCAPE[c] ?? c);
}

/** Strip all HTML tags - for plain text fields */
export function stripHtml(input: string): string {
  return String(input)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

/** Sanitize product/game names - allow letters, numbers, basic punctuation */
export function sanitizeName(input: string, maxLen = 120): string {
  let s = stripHtml(String(input ?? ""));
  // Remove control chars, limit length
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s;
}

/** Sanitize slug - only a-z0-9- */
export function sanitizeSlug(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Validate and sanitize URL for images */
export function isSafeImageUrl(url: string): boolean {
  const s = String(url ?? "").trim();
  if (!s) return false;
  // Allow /art/, /api/media/, data:image/, https://
  if (s.startsWith("/art/")) return /^[a-zA-Z0-9/_\-.]+$/.test(s) && !s.includes("..");
  if (s.startsWith("/api/media/")) return /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(s);
  if (s.startsWith("data:image/")) {
    // Only allow safe image data URIs, no script
    return /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[a-zA-Z0-9+/=]+$/.test(s.slice(0, 200)) || s.startsWith("data:image/svg+xml,");
  }
  if (s.startsWith("https://")) {
    try {
      const u = new URL(s);
      // Block private IPs, localhost, etc
      const host = u.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) return false;
      // Must be image extension or known CDN
      return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(u.pathname) || u.hostname.includes("cloudinary") || u.hostname.includes("imgur") || u.hostname.includes("g2x.gg");
    } catch {
      return false;
    }
  }
  return false;
}

/** Sanitize URL - returns safe URL or empty */
export function sanitizeImageUrl(input: string, fallback = ""): string {
  const s = String(input ?? "").trim();
  if (!s) return fallback;
  if (isSafeImageUrl(s)) return s;
  // Try to extract safe path
  if (s.startsWith("/") && !s.includes("..") && !s.includes("<") && !s.includes(">")) {
    // Only allow /art/ and /api/media/
    if (s.startsWith("/art/") || s.startsWith("/api/media/")) return s;
  }
  return fallback;
}

/** Validate email safely */
export function isValidEmail(email: string): boolean {
  const s = String(email ?? "").trim();
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !s.includes("..") && !/[<>"']/.test(s);
}

/** Sanitize search query */
export function sanitizeSearch(q: string): string {
  let s = stripHtml(String(q ?? ""));
  s = s.replace(/[%_\\]/g, ""); // Prevent LIKE injection
  s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, " ").replace(/\s+/g, " ").trim();
  return s.slice(0, 100);
}

/** Check for XSS patterns */
export function containsXSS(input: string): boolean {
  const s = String(input ?? "").toLowerCase();
  const patterns = [
    "<script", "javascript:", "onerror=", "onload=", "onclick=", "onmouseover=",
    "eval(", "expression(", "vbscript:", "data:text/html",
    "<iframe", "<object", "<embed", "<link", "<meta", "<style",
    "document.cookie", "document.write", "window.location",
    "fromcharcode", "base64",
  ];
  return patterns.some((p) => s.includes(p));
}

/** Sanitize CMS HTML - allow only safe tags */
export function sanitizeCmsHtml(html: string): string {
  let s = String(html ?? "");
  // Remove dangerous tags entirely
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  s = s.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  s = s.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  s = s.replace(/<embed\b[^>]*>/gi, "");
  s = s.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/on\w+\s*=\s*[^\s>]+/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/vbscript\s*:/gi, "");
  return s.slice(0, 10000);
}

/** Validate price - prevent negative, NaN, etc */
export function sanitizePrice(input: unknown, min = 0.01, max = 100000): number | null {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

/** Check for SQL injection patterns (defense in depth - we use parameterized queries anyway) */
export function containsSQLi(input: string): boolean {
  const s = String(input ?? "").toLowerCase();
  const patterns = [
    "' or '1'='1", "' or 1=1", "\" or \"1\"=\"1\"",
    "union select", "union all select",
    "drop table", "delete from", "insert into",
    "--", "/*", "*/", ";--", "';--",
    "xp_", "sp_", "exec(", "execute(",
  ];
  return patterns.some((p) => s.includes(p));
}

/** Rate limit key sanitization */
export function sanitizeRateLimitKey(key: string): string {
  return String(key ?? "").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 100);
}
