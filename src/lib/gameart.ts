/**
 * GAME ARTWORK, WITHOUT NETWORK REQUESTS
 * ======================================
 * Games with no uploaded logo previously pointed at `/api/gameart/<slug>`.
 * That looked fine with a handful of games, but the seller wizard lists every
 * game in a category — 115 for Items — and the picker rendered them all
 * eagerly. One page was firing **347 HTTP requests**, each of which hit the
 * database to look up the game's name.
 *
 * Locally that stalled the page for 15-20 seconds. On Netlify each request is a
 * serverless invocation, so the browser opened hundreds of connections at once,
 * the function pool saturated, and the RSC stream was cut — surfacing as
 * "Application error: a client-side exception has occurred" with
 * "Error: Connection closed." in the console.
 *
 * The tile is a deterministic gradient plus the game's initials, which needs no
 * database and no I/O. Generating it as an inline `data:` URI means the browser
 * makes **zero** requests: the markup carries the image. Each tile is ~380
 * bytes, and it renders identically on the server and the client.
 */

/** Stable hash so a slug always produces the same colours. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Up to two initials, skipping noise words. */
function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["the", "a", "of", "and", "for", "vs", "to"].includes(w.toLowerCase()));
  if (!words.length) return "G";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** XML-escape the few characters that can appear in a game name. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * An inline SVG data URI for a game tile.
 * `key` should be the slug (stable colours); `name` drives the initials.
 */
export function gameArt(key: string, name?: string): string {
  const label = name?.trim() || key.replace(/-/g, " ");
  const h = hash(key);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 50)) % 360;
  const text = esc(initials(label));
  const size = text.length > 1 ? 30 : 38;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">` +
    `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 68% 58%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue2} 72% 38%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="80" height="80" rx="18" fill="url(#a)"/>` +
    `<text x="40" y="40" font-family="Inter,system-ui,sans-serif" font-size="${size}"` +
    ` font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central">${text}</text>` +
    `</svg>`;

  // encodeURIComponent keeps this valid in an <img src> without base64 bloat.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** True when a stored logo is a generated placeholder rather than real art. */
export const isGeneratedArt = (logo?: string | null) =>
  !!logo && (logo.startsWith("/api/gameart/") || logo.startsWith("data:image/svg+xml"));

/**
 * Resolve whatever is stored in `games.logo` to something renderable.
 * A real uploaded logo passes through untouched.
 */
export function resolveLogo(logo: string | null | undefined, key: string, name?: string): string {
  if (!logo || logo.startsWith("/api/gameart/")) return gameArt(key, name);
  return logo;
}
