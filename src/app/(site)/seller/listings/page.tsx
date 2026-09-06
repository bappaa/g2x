import { requireUser } from "@/lib/session";
import { getSellerListings, getGames, getCategories } from "@/lib/queries";
import ListingsView from "@/components/seller/ListingsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Listings — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const [listings, games, cats] = await Promise.all([
    getSellerListings(u.id),
    getGames(),
    getCategories(),
  ]);
  return (
    <ListingsView
      listings={listings as never}
      games={games.map((g) => ({ slug: g.slug, name: g.name }))}
      categories={cats.filter((c) => ["accounts", "boosting"].includes(c.slug))}
    />
  );
}
