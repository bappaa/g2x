import { notFound } from "next/navigation";
import Link from "next/link";
import { Zap, ShieldCheck, BadgeCheck } from "lucide-react";
import {
  getGame,
  getCategory,
  getProducts,
  getListings,
  getGameCategories,
  getGames,
} from "@/lib/queries";
import { AnyLogo } from "@/components/BrandIcon";
import { Breadcrumb, Pill } from "@/components/ui";
import ProductCard from "@/components/browse/ProductCard";
import ListingGrid from "@/components/browse/ListingGrid";
import GameRail from "@/components/browse/GameRail";

// Cached and shared by all visitors so navigation is instant. Per-user
// state (wishlist hearts) hydrates client-side from /api/wishlist.
export const revalidate = 300;

export default async function Page({
  params,
}: {
  params: { game: string; category: string };
}) {
  const [game, cat] = await Promise.all([getGame(params.game), getCategory(params.category)]);
  if (!game || !cat) notFound();

  const isListing = cat.slug === "accounts" || cat.slug === "boosting";

  const [products, listings, gameCats, allGames] = await Promise.all([
    isListing ? Promise.resolve([]) : getProducts(game.slug, cat.slug),
    isListing ? getListings({ game: game.slug, category: cat.slug }) : Promise.resolve([]),
    getGameCategories(game.slug),
    getGames(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1220px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: cat.name, href: `/c/${cat.slug}` },
          { label: game.name },
        ]}
      />

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-5">
        <GameRail
          games={allGames.map((g) => ({ slug: g.slug, name: g.name, logo: g.logo }))}
          activeGame={game.slug}
          activeCategory={cat.slug}
        />

        <div className="min-w-0 space-y-5">
          <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl panel p-4 sm:gap-4 sm:p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl soft sm:h-14 sm:w-14">
              <AnyLogo logo={game.logo} size={56} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-[17px] font-black leading-tight tracking-tight sm:text-[22px]">
                {game.name} {cat.name}
              </h1>
              <p className="mt-1 text-[12.5px] muted">
                {cat.blurb} for {game.name}. Instant delivery, safe &amp; secure.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] sm:text-[11.5px]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Zap size={12} /> Instant Delivery
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck size={12} /> Safe &amp; Secure
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <BadgeCheck size={12} /> 100% Trusted
                </span>
              </div>
            </div>
          </div>

          {isListing ? (
            <ListingGrid listings={listings} category={cat.slug} />
          ) : products.length ? (
            <div className="rounded-2xl panel p-3.5 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
                <h2 className="text-[14px] font-bold">{cat.name} Packages</h2>
                <span className="text-[11.5px] muted">{products.length} products</span>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {products.map((p, i) => (
                  <ProductCard key={p.id} p={p} i={i} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--line)] px-6 py-14 text-center">
              <div className="text-[14px] font-semibold">No products yet</div>
              <div className="mt-1 text-[12px] muted">This category is being stocked.</div>
            </div>
          )}

          <div className="rounded-2xl panel p-4 sm:p-5">
            <h3 className="mb-3 text-[13px] font-bold">Other {game.name} Categories</h3>
            <div className="flex flex-wrap gap-2">
              {gameCats
                .filter((c) => c.slug !== cat.slug)
                .map((c) => (
                  <Link key={c.slug} href={`/g/${game.slug}/${c.slug}`}>
                    <Pill>{c.name}</Pill>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
