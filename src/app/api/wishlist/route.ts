import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { all } from "@/lib/db";

/**
 * The signed-in user's wishlist ids.
 *
 * Catalog pages are cached and shared between all visitors, so they cannot
 * embed per-user state. The heart icons hydrate from this tiny endpoint
 * instead — which is what lets those pages be served from the full route
 * cache and navigate instantly.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getSessionUser();
  if (!u)
    return NextResponse.json(
      { ids: [], signedIn: false },
      { headers: { "Cache-Control": "private, no-store" } }
    );

  const rows = await all<{ item_id: string }>(
    `SELECT item_id FROM wishlist WHERE user_id=?`,
    [u.id]
  );
  return NextResponse.json(
    { ids: rows.map((r) => r.item_id), signedIn: true },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
