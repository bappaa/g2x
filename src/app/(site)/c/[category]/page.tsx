import { notFound } from "next/navigation";
import {
  getCategory,
  getCategoryGameIndex,
  getPopularProducts,
  getListings,
} from "@/lib/queries";
import { Breadcrumb, FadeIn } from "@/components/ui";
import ProductCard from "@/components/browse/ProductCard";
import ListingGrid from "@/components/browse/ListingGrid";
import GameIndex from "@/components/browse/GameIndex";

// Cached and shared by all visitors so navigation is instant. Per-user
// state (wishlist hearts) hydrates client-side from /api/wishlist.
export const revalidate = 300;

export default async function Page({ params }: { params: { category: string } }) {
  const cat = await getCategory(params.category);
  if (!cat) notFound();

  const isListing = cat.slug === "accounts" || cat.slug === "boosting";
  const [games, featured, listings] = await Promise.all([
    getCategoryGameIndex(cat.slug),
    isListing ? Promise.resolve([]) : getPopularProducts(cat.slug, 12),
    isListing ? getListings({ category: cat.slug, limit: 48 }) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1220px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: cat.name }]} />

      <FadeIn className="mt-4">
        <div className="relative overflow-hidden rounded-2xl panel p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-pulseGlow rounded-full bg-brand-600/25 blur-[90px]" />
          <h1 className="text-[18px] font-black sm:text-[30px] tracking-tight">
            <span className="grad-text">{cat.name}</span>
          </h1>
          <p className="mt-2 max-w-[560px] text-[13px] muted">
            {cat.blurb}. Compare offers from verified sellers and get the best price with instant
            delivery and full buyer protection.
          </p>
        </div>
      </FadeIn>

      <div className="mt-5">
        <GameIndex games={games} category={cat.slug} />
      </div>

      {isListing && (
        <div className="mt-5">
          <ListingGrid listings={listings} category={cat.slug} />
        </div>
      )}

      {featured.length > 0 && (
        <section className="mt-5 rounded-2xl panel p-4 sm:p-5">
          <h2 className="mb-4 text-[14px] font-bold">Popular {cat.name} packages</h2>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {featured.map((p, i) => (
              <ProductCard key={p.id} p={p} i={i} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
