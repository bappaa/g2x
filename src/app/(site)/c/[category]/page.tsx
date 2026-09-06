import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCategory,
  getGamesForCategory,
  getPopularProducts,
  getListings,
} from "@/lib/queries";
import { AnyLogo } from "@/components/BrandIcon";
import { Breadcrumb, FadeIn } from "@/components/ui";
import ProductCard from "@/components/browse/ProductCard";
import ListingGrid from "@/components/browse/ListingGrid";

// Cached and shared by all visitors so navigation is instant. Per-user
// state (wishlist hearts) hydrates client-side from /api/wishlist.
export const revalidate = 300;

export default async function Page({ params }: { params: { category: string } }) {
  const cat = await getCategory(params.category);
  if (!cat) notFound();

  const isListing = cat.slug === "accounts" || cat.slug === "boosting";
  const [games, featured, listings] = await Promise.all([
    getGamesForCategory(cat.slug),
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

      <section className="mt-5 rounded-2xl panel p-4 sm:p-5">
        <h2 className="mb-4 text-[14px] font-bold">Choose a game</h2>
        <div className="grid min-w-0 grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4 lg:grid-cols-7">
          {games.slice(0, 35).map((g) => (
            <Link key={g.slug} href={`/g/${g.slug}/${cat.slug}`} className="group block">
              <div className="tile aspect-square w-full border border-[var(--line)] soft">
                <div className="grid h-full w-full place-items-center overflow-hidden transition-transform duration-500 group-hover:scale-110">
                  <AnyLogo logo={g.logo} size={g.logo.startsWith("/") ? 200 : 44} />
                </div>
              </div>
              <div className="mt-2 text-center text-[11px] font-medium transition-colors group-hover:text-brand-500">
                {g.name}
              </div>
            </Link>
          ))}
        </div>
        {games.length > 35 && (
          <div className="mt-4 text-center text-[11.5px] muted">
            +{games.length - 35} more games in {cat.name} — use the search bar above to jump straight
            to one.
          </div>
        )}
      </section>

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
