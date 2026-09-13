import { notFound } from "next/navigation";
import {
  getGame,
  getCategory,
  getProduct,
  getOffers,
  getProducts,
  getListing,
} from "@/lib/queries";
import ProductView from "@/components/browse/ProductView";
import ListingDetail from "@/components/browse/ListingDetail";

// Cached and shared by all visitors so navigation is instant. Per-user
// state (wishlist hearts) hydrates client-side from /api/wishlist.
export const revalidate = 300;

export default async function Page({
  params,
}: {
  params: { game: string; category: string; slug: string };
}) {
  const [game, cat] = await Promise.all([getGame(params.game), getCategory(params.category)]);
  if (!game || !cat) notFound();

  /* accounts & boosting are standalone seller listings */
  if (cat.slug === "accounts" || cat.slug === "boosting") {
    const listing = await getListing(params.slug);
    if (!listing) notFound();
    return <ListingDetail game={game} category={cat} listing={listing} />;
  }

  const product = await getProduct(game.slug, params.slug);
  if (!product) notFound();

  const [offers, related] = await Promise.all([
    getOffers(product.id),
    getProducts(game.slug, cat.slug),
  ]);

  return (
    <ProductView
      game={game}
      category={cat}
      product={product}
      offers={offers}
      related={related.filter((r) => r.id !== product.id).slice(0, 6)}
    />
  );
}
