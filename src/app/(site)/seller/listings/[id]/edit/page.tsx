import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { one, all } from "@/lib/db";
import { Breadcrumb } from "@/components/ui";
import EditListingClient from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Listing — G2X.GG" };

type ListingDbRow = {
  id: string;
  title: string;
  game_name: string | null;
  category_name: string | null;
  game_slug: string;
  category_slug: string;
  price: number;
  stock: number;
  description: string | null;
  image: string;
  tier: string | null;
  level: number | null;
  outfits: number | null;
  delivery_time: string | null;
  status: string;
};

type OptRow = { slug: string; name: string };

export default async function Page({ params }: { params: { id: string } }) {
  const s = await requireSeller();
  const listing = await one<ListingDbRow>(
    `SELECT l.*, g.name as game_name, c.name as category_name FROM listings l
     LEFT JOIN games g ON g.slug=l.game_slug
     LEFT JOIN categories c ON c.slug=l.category_slug
     WHERE l.id=? AND l.seller_id=?`,
    [params.id, s.id]
  );
  if (!listing) notFound();

  const gamesList = await all<OptRow>(`SELECT slug, name FROM games WHERE status='active' ORDER BY name`);
  const catsList = await all<OptRow>(`SELECT slug, name FROM categories WHERE status='active' ORDER BY name`);

  return (
    <div className="space-y-4 max-w-[720px] mx-auto">
      <Breadcrumb
        items={[
          { label: "Seller", href: "/seller" },
          { label: "My Offers", href: "/seller/offers" },
          { label: `Edit ${listing.title}` },
        ]}
      />
      <div className="rounded-2xl panel p-4">
        <h1 className="text-[18px] font-black">Edit Listing</h1>
        <p className="mt-1 text-[12px] muted">{listing.game_name} · {listing.category_name}</p>
      </div>
      <EditListingClient listing={listing as unknown as never} games={gamesList} categories={catsList} />
    </div>
  );
}
