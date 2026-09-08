import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/session";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Catalog search for the offer editor.
 *
 * The offers page used to embed the entire product catalog (927 rows, ~1.3 MB
 * of JSON) into the HTML on every load, purely so the edit modal could filter
 * it client-side. The modal never shows more than 40 rows, so it now queries
 * this endpoint as the seller types instead. That took the page from 1.46 MB
 * to ~150 KB.
 */
export async function GET(req: Request) {
  await requireSeller();

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;

  const rows = await all(
    `SELECT p.id, p.name, p.image, p.base_price, p.game_slug, p.category_slug,
            g.name AS game_name, c.name AS category_name,
            (SELECT MIN(o.price) FROM offers o
              WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS market_min,
            (SELECT COUNT(*) FROM offers o
              WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS offer_count
       FROM products p
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
      WHERE p.status='active'
        ${q ? "AND (p.name LIKE ? OR g.name LIKE ?)" : ""}
      ORDER BY g.sort_order, c.sort_order, p.base_price
      LIMIT 40`,
    q ? [like, like] : []
  );

  return NextResponse.json(rows);
}
