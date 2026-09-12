import "server-only";
import { unstable_cache } from "next/cache";
import { all } from "./db";

/**
 * Catalog data changes rarely (admin edits) but is read on EVERY page render.
 * Cache it in the Next data cache and bust it with revalidateTag("catalog")
 * whenever the admin mutates games / categories / products.
 */

export type SearchItem = { label: string; href: string; logo: string; kind: string };

export const getSearchIndex = unstable_cache(
  async (): Promise<SearchItem[]> => {
    const [games, products] = await Promise.all([
      all<{ name: string; slug: string; logo: string }>(
        `SELECT name, slug, logo FROM games WHERE status='active'
          ORDER BY CASE WHEN substr(name,1,1) GLOB '[0-9]' THEN 0 ELSE 1 END, lower(name)`
      ),
      all<{ name: string; slug: string; game_slug: string; category_slug: string; image: string }>(
        `SELECT name, slug, game_slug, category_slug, image FROM products
          WHERE status='active' AND popular=1 LIMIT 400`
      ),
    ]);
    return [
      ...games.map((g) => ({ label: g.name, href: `/g/${g.slug}`, logo: g.logo, kind: "Game" })),
      ...products.map((p) => ({
        label: p.name,
        href: `/g/${p.game_slug}/${p.category_slug}/${p.slug}`,
        logo: p.image,
        kind: "Product",
      })),
    ];
  },
  ["search-index"],
  { tags: ["catalog"], revalidate: 300 }
);

export const getNavGames = unstable_cache(
  async () =>
    all<{ slug: string; name: string; logo: string }>(
      `SELECT slug, name, logo FROM games WHERE status='active'
        ORDER BY CASE WHEN substr(name,1,1) GLOB '[0-9]' THEN 0 ELSE 1 END, lower(name) LIMIT 24`
    ),
  ["nav-games"],
  { tags: ["catalog"], revalidate: 300 }
);

export const getNavCategories = unstable_cache(
  async () =>
    all<{ slug: string; name: string; icon: string }>(
      `SELECT slug, name, icon FROM categories WHERE status='active' ORDER BY sort_order`
    ),
  ["nav-categories"],
  { tags: ["catalog"], revalidate: 300 }
);
