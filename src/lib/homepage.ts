import "server-only";
import { unstable_cache } from "next/cache";
import { all } from "./db";

/**
 * Homepage content resolver.
 *
 * Every section is driven by the `cms_blocks` table (admin panel → CMS Blocks).
 * List-type sections store their rows as JSON in `cms_blocks.data`.
 *
 * Nothing here is hardcoded content: if the admin has not filled a block in,
 * the section simply does not render. Tiles that show real catalog data are
 * derived from the `games` / `products` tables, so removing a game from the
 * admin panel removes it from the homepage too.
 */

export type CmsRow = {
  key: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image: string | null;
  cta_label: string | null;
  cta_href: string | null;
  data: string | null;
  active: number;
};

export type Block = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
  items: Record<string, string>[];
  active: boolean;
};

const parseItems = (raw: string | null): Record<string, string>[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
};

const toBlock = (r: CmsRow): Block => ({
  key: r.key,
  title: r.title ?? "",
  subtitle: r.subtitle ?? "",
  body: r.body ?? "",
  image: r.image ?? "",
  ctaLabel: r.cta_label ?? "",
  ctaHref: r.cta_href ?? "",
  items: parseItems(r.data),
  active: r.active === 1,
});

/** All active CMS blocks keyed by block key. Cached; busted on any CMS write. */
export const getBlocks = unstable_cache(
  async (): Promise<Record<string, Block>> => {
    const rows = await all<CmsRow>(`SELECT * FROM cms_blocks WHERE active=1`);
    const out: Record<string, Block> = {};
    rows.forEach((r) => {
      out[r.key] = toBlock(r);
    });
    return out;
  },
  ["cms-blocks"],
  { tags: ["catalog", "cms"], revalidate: 300 }
);

/* ==================================================================== */
/* Catalog-derived tiles                                                 */
/* ==================================================================== */

export type Tile = { label: string; logo: string; href: string; badge?: string };

/**
 * Popular tiles for a category, straight from the DB.
 * Uses games flagged into that category via `game_categories`.
 */
export const popularTiles = unstable_cache(
  async (categorySlug: string, limit = 5): Promise<Tile[]> => {
    const rows = await all<{ slug: string; name: string; logo: string }>(
      `SELECT g.slug, g.name, g.logo
         FROM games g
         JOIN game_categories gc ON gc.game_slug = g.slug
        WHERE gc.category_slug = ? AND g.status = 'active'
        ORDER BY g.sort_order, g.name
        LIMIT ?`,
      [categorySlug, limit]
    );
    return rows.map((g) => ({
      label: g.name,
      logo: g.logo,
      href: `/g/${g.slug}/${categorySlug}`,
    }));
  },
  ["popular-tiles"],
  { tags: ["catalog"], revalidate: 300 }
);

/** Distinct brands inside a category, derived from products. */
export const categoryBrands = unstable_cache(
  async (categorySlug: string, limit = 7): Promise<Tile[]> => {
    const rows = await all<{ slug: string; name: string; logo: string }>(
      `SELECT g.slug, g.name, g.logo
         FROM games g
         JOIN products p ON p.game_slug = g.slug
        WHERE p.category_slug = ? AND g.status='active' AND p.status='active'
        GROUP BY g.slug
        ORDER BY COUNT(p.id) DESC, g.name
        LIMIT ?`,
      [categorySlug, limit]
    );
    return rows.map((g) => ({
      label: g.name,
      logo: g.logo,
      href: `/g/${g.slug}/${categorySlug}`,
    }));
  },
  ["category-brands"],
  { tags: ["catalog"], revalidate: 300 }
);

/**
 * Canonical category order — the same order as the main navigation:
 * Currency, Top Up, Items, Accounts, Subscription, Boosting.
 *
 * `categories.sort_order` is the real source of truth, but a database that
 * was seeded before sort_order existed (or restored without it) leaves every
 * row at 0, and `ORDER BY sort_order, name` then silently degrades to
 * alphabetical — which is why the homepage tiles and the footer were showing
 * Accounts, Boosting, Currency... This CASE pins the known slugs regardless,
 * and anything the admin adds later sorts after them by its own sort_order.
 */
/**
 * Catalog sort order used site-wide: **numbers first, then A-Z**.
 *
 * SQLite's default collation orders by code point, which already puts digits
 * before letters, but it is also case-sensitive ("Zelda" < "apex"). Lowercasing
 * inside the sort fixes that, and the leading CASE guarantees the numeric block
 * comes first even for names starting with punctuation.
 */
export const NAME_SORT = (col: string) =>
  `CASE WHEN substr(${col},1,1) GLOB '[0-9]' THEN 0 ELSE 1 END, lower(${col})`;

/** JS equivalent of NAME_SORT, for sorting rows already in memory. */
export function collate(a: string, b: string): number {
  const na = /^[0-9]/.test(a) ? 0 : 1;
  const nb = /^[0-9]/.test(b) ? 0 : 1;
  if (na !== nb) return na - nb;
  return a.toLowerCase().localeCompare(b.toLowerCase(), "en", { numeric: true });
}

export const CATEGORY_ORDER = [
  "currency",
  "top-up",
  "items",
  "accounts",
  "subscriptions",
  "boosting",
] as const;

/** SQL fragment ordering categories the same way the navbar does. */
const CATEGORY_ORDER_SQL = `
  CASE c.slug
    ${CATEGORY_ORDER.map((slug, i) => `WHEN '${slug}' THEN ${i}`).join("\n    ")}
    ELSE 100 + COALESCE(c.sort_order, 0)
  END, c.sort_order, c.name`;

/** Category rail definitions come from the `categories` table, admin-managed. */
export const homeCategories = unstable_cache(
  async () =>
    all<{ slug: string; name: string; icon: string; blurb: string }>(
      `SELECT c.slug, c.name, c.icon, c.blurb FROM categories c
        WHERE c.status='active' ORDER BY ${CATEGORY_ORDER_SQL}`
    ),
  ["home-categories"],
  { tags: ["catalog"], revalidate: 300 }
);

/** Live marketplace counters — real numbers, not invented ones. */
export const liveStats = unstable_cache(
  async () => {
    const [r] = await all<{
      offers: number; sellers: number; orders: number; games: number; buyers: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM offers WHERE status='active')                AS offers,
         (SELECT COUNT(*) FROM seller_profiles WHERE status='active')       AS sellers,
         (SELECT COUNT(*) FROM orders)                                      AS orders,
         (SELECT COUNT(*) FROM games WHERE status='active')                 AS games,
         (SELECT COUNT(*) FROM users)                                       AS buyers`
    );
    return r ?? { offers: 0, sellers: 0, orders: 0, games: 0, buyers: 0 };
  },
  ["live-stats"],
  { tags: ["catalog"], revalidate: 120 }
);

/** Real buyer reviews for the testimonial rail. */
export const homeReviews = unstable_cache(
  async (limit = 6) =>
    all<{ id: string; stars: number; body: string; name: string; created_at: string }>(
      `SELECT r.id, r.stars, r.body, u.name, r.created_at
         FROM reviews r JOIN users u ON u.id = r.buyer_id
        WHERE r.stars >= 4 AND r.body IS NOT NULL AND TRIM(r.body) <> ''
        ORDER BY r.created_at DESC LIMIT ?`,
      [limit]
    ),
  ["home-reviews"],
  { tags: ["catalog", "reviews"], revalidate: 300 }
);

/** Footer link columns, admin-managed via the `nav_links` table. */
export const footerNav = unstable_cache(
  async (): Promise<{ heading: string; links: { label: string; href: string }[] }[]> => {
    const rows = await all<{ section: string; label: string; href: string }>(
      `SELECT section, label, href FROM nav_links
        WHERE placement='footer' AND active=1
        ORDER BY sort_order, label`
    );
    const order: string[] = [];
    const map: Record<string, { label: string; href: string }[]> = {};
    rows.forEach((r) => {
      if (!map[r.section]) {
        map[r.section] = [];
        order.push(r.section);
      }
      map[r.section].push({ label: r.label, href: r.href });
    });
    return order.map((heading) => ({ heading, links: map[heading] }));
  },
  ["footer-nav"],
  { tags: ["catalog", "nav"], revalidate: 300 }
);

/* ==================================================================== */
/* Navigation mega-menu                                                  */
/* ==================================================================== */

export type MenuGame = { slug: string; name: string; logo: string; href: string };
export type MenuCategory = {
  slug: string;
  name: string;
  /** Highest `sort_order` games — the short "Popular" column. */
  popular: MenuGame[];
  /** Every game in the category, for the searchable "All games" column. */
  all: MenuGame[];
};

/**
 * Data behind the header's category dropdowns.
 *
 * One row per active category, each carrying the games that actually have
 * listings in it, so the menu is entirely admin-driven: remove a game or a
 * category in the admin panel and it disappears from the nav. Cached with the
 * catalog tag, so a catalog write refreshes it.
 */
export const navMenu = unstable_cache(
  async (): Promise<MenuCategory[]> => {
    const cats = await all<{ slug: string; name: string }>(
      `SELECT c.slug, c.name FROM categories c
        WHERE c.status='active' ORDER BY ${CATEGORY_ORDER_SQL}`
    );
    /**
     * `sold` is real completed sales volume for that game *within that
     * category*, so "Popular games" ranks itself from actual demand with no
     * admin curation. `NAME_SORT` puts digits before letters so the full list
     * reads 0-9 then A-Z, matching the alphabet index on the category pages.
     */
    const rows = await all<{
      category_slug: string; slug: string; name: string; logo: string; sold: number;
    }>(
      `SELECT gc.category_slug, g.slug, g.name, g.logo,
              COALESCE((
                SELECT SUM(oi.qty) FROM order_items oi
                  JOIN products p ON p.id = oi.product_id
                 WHERE p.game_slug = g.slug
                   AND p.category_slug = gc.category_slug
                   AND oi.status IN ('delivered','completed')
              ), 0)
              + COALESCE((
                SELECT SUM(oi.qty) FROM order_items oi
                  JOIN listings l ON l.id = oi.listing_id
                 WHERE l.game_slug = g.slug
                   AND l.category_slug = gc.category_slug
                   AND oi.status IN ('delivered','completed')
              ), 0) AS sold
         FROM games g
         JOIN game_categories gc ON gc.game_slug = g.slug
        WHERE g.status='active'
        ORDER BY ${NAME_SORT("g.name")}`
    );

    return cats.map((c) => {
      const inCat = rows.filter((r) => r.category_slug === c.slug);
      const toGame = (g: (typeof inCat)[number]) => ({
        slug: g.slug,
        name: g.name,
        logo: g.logo,
        href: `/g/${g.slug}/${c.slug}`,
      });
      // "All games" stays 0-9 then A-Z; "Popular" is purely sales-driven.
      const all = inCat.map(toGame);
      const popular = [...inCat]
        .sort((a, b) => b.sold - a.sold || collate(a.name, b.name))
        .slice(0, 10)
        .map(toGame);
      return { slug: c.slug, name: c.name, popular, all };
    });
  },
  ["nav-menu"],
  { tags: ["catalog", "nav"], revalidate: 300 }
);
