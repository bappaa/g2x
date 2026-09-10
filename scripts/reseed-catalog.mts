/**
 * REBUILD THE CATALOG
 * ===================
 * Replaces the demo catalog with the client's real game list.
 *
 * Deliberately conservative about what it touches:
 *   - Wipes only catalog tables (games, game_categories, products, offers,
 *     listings) — users, orders, sellers, wallets and settings are untouched.
 *   - Creates ONE game per name, attached to every category it appears in, so
 *     "Roblox" is a single game that shows under Top Up, Items and Accounts
 *     rather than three duplicates.
 *   - Creates NO products and NO field templates. The client said they will
 *     add per-product requirements themselves, and a blank slate is what makes
 *     each game genuinely different in the seller panel instead of every game
 *     inheriting the same demo fields.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./g2x.db";
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const CATALOG: Record<string, string[]> = JSON.parse(
  readFileSync("scripts/catalog.json", "utf8")
);

/** URL-safe slug that stays stable and unique across the list. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "game";
}

/** Deterministic accent colour per game, so the generated art is varied. */
function accent(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [265, 280, 220, 190, 330, 20, 145, 45, 300, 170];
  return `hsl(${hues[h % hues.length]} 70% 55%)`;
}

async function main() {
  console.log(`[reseed] target: ${url.startsWith("file:") ? url : "Turso (remote)"}`);

  // --- collect unique games and the categories each belongs to -------------
  const games = new Map<string, { name: string; cats: string[] }>();
  for (const [cat, names] of Object.entries(CATALOG)) {
    for (const name of names) {
      const slug = slugify(name);
      const g = games.get(slug) ?? { name, cats: [] };
      if (!g.cats.includes(cat)) g.cats.push(cat);
      games.set(slug, g);
    }
  }
  console.log(`[reseed] ${games.size} unique games across ${Object.keys(CATALOG).length} categories`);

  // --- wipe ONLY the catalog ----------------------------------------------
  for (const sql of [
    `DELETE FROM offers`,
    `DELETE FROM listings`,
    `DELETE FROM products`,
    `DELETE FROM game_categories`,
    `DELETE FROM games`,
    `DELETE FROM field_templates`,
  ]) {
    await db.execute(sql).catch((e) => console.warn("  skip:", String(e.message).slice(0, 70)));
  }

  // --- insert games + their category links --------------------------------
  let n = 0;
  let links = 0;
  for (const [slug, g] of games) {
    await db.execute({
      // Empty logo = generate a tile inline (see src/lib/gameart.ts).
      sql: `INSERT INTO games (slug,name,logo,accent,status,sort_order)
            VALUES (?,?,?,?, 'active', ?)`,
      args: [slug, g.name, "", accent(g.name), n],
    });
    for (const c of g.cats) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO game_categories (game_slug,category_slug) VALUES (?,?)`,
        args: [slug, c],
      });
      links++;
    }
    n++;
  }

  console.log(`[reseed] inserted ${n} games, ${links} category links`);
  console.log(`[reseed] products: 0 (add them from the admin panel)`);

  for (const c of Object.keys(CATALOG)) {
    const r = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM game_categories WHERE category_slug=?`,
      args: [c],
    });
    console.log(`           ${c.padEnd(10)} ${(r.rows[0] as { n: number }).n} games`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[reseed] failed:", e);
    process.exit(1);
  });
