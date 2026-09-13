import { NextResponse } from "next/server";
import { getSearchIndex } from "@/lib/cache";

// Public catalog data — cache it hard at the edge.
export const revalidate = 300;

/**
 * Header search.
 *
 * The full index (~45 KB of games + products) used to be embedded in the HTML
 * of every single page, for a box most visitors never touch. It is fetched on
 * first focus instead, which took ~45 KB off every page on the site.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const index = await getSearchIndex();
  const rows = q ? index.filter((r) => r.label.toLowerCase().includes(q)) : index;

  return NextResponse.json(rows.slice(0, 12), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
