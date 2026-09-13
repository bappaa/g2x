/**
 * IMAGE SRC GUARD
 * ===============
 * `next/image` throws at render time when `src` is null/undefined/empty:
 *
 *   TypeError: Cannot read properties of null (reading 'default')
 *
 * That is a *server* exception, so a single row with a missing image turns a
 * whole page into a 500 (digest error page) rather than a missing thumbnail.
 * Catalog rows are admin-authored and offers/order items snapshot their image
 * at purchase time, so a null is always reachable in production data.
 *
 * `img()` funnels every dynamic Image src through one place with a real
 * on-disk fallback. Client-safe: no imports, no server-only APIs.
 */

/** Neutral tile shipped in `public/art`. */
export const PLACEHOLDER = "/art/placeholder.png";

/** Return a src `next/image` will always accept. */
export function img(src?: string | null): string {
  if (typeof src !== "string") return PLACEHOLDER;
  const s = src.trim();
  if (!s) return PLACEHOLDER;
  // Relative paths must be root-anchored for next/image.
  if (s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:"))
    return s;
  return `/${s}`;
}
