import { one } from "@/lib/db";

/**
 * Generated game artwork.
 *
 * 169 games with no supplied logos would otherwise all share one placeholder,
 * making the catalog unreadable. This renders a small SVG tile per game:
 * a deterministic gradient derived from the slug plus the game's initials, so
 * every game is visually distinct and instantly recognisable in a list.
 *
 * It is an SVG (about 400 bytes), cached immutably, so it costs far less than
 * a real image and needs no build step. The moment an admin uploads a real
 * logo, `games.logo` points at that instead and this route is bypassed.
 */
export const revalidate = 86400;

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

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug.replace(/\.(png|svg|jpg|webp)$/i, "");

  const game = await one<{ name: string }>(
    `SELECT name FROM games WHERE slug=?`,
    [slug]
  ).catch(() => null);

  const name = game?.name ?? slug.replace(/-/g, " ");
  const h = hash(slug);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 50)) % 360;
  const text = initials(name);
  const size = text.length > 1 ? 30 : 38;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 80 80">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 68% 58%)"/>
<stop offset="1" stop-color="hsl(${hue2} 72% 38%)"/>
</linearGradient></defs>
<rect width="80" height="80" rx="18" fill="url(#g)"/>
<text x="40" y="40" font-family="Inter,system-ui,sans-serif" font-size="${size}" font-weight="800"
 fill="#fff" fill-opacity="0.96" text-anchor="middle" dominant-baseline="central">${text}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
