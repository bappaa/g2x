import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getGame, getGameCategories, getProducts } from "@/lib/queries";
import { AnyLogo } from "@/components/BrandIcon";
import { Breadcrumb, FadeIn } from "@/components/ui";
import ProductCard from "@/components/browse/ProductCard";

// Cached and shared by all visitors so navigation is instant. Per-user
// state (wishlist hearts) hydrates client-side from /api/wishlist.
export const revalidate = 300;

export default async function Page({ params }: { params: { game: string } }) {
  const game = await getGame(params.game);
  if (!game) notFound();

  const cats = await getGameCategories(game.slug);
  const blocks = await Promise.all(
    cats
      .filter((c) => !["accounts", "boosting"].includes(c.slug))
      .map(async (c) => ({ cat: c, products: await getProducts(game.slug, c.slug) }))
  );

  return (
    <main className="mx-auto max-w-[1220px] px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: game.name }]} />

      <FadeIn className="mt-4">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl panel p-4 sm:p-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl soft">
            <AnyLogo logo={game.logo} size={64} />
          </div>
          <div>
            <h1 className="text-[18px] font-black sm:text-[28px] tracking-tight">{game.name}</h1>
            <p className="mt-1 text-[12.5px] muted">
              Top ups, currency, accounts, items and boosting for {game.name} — from verified sellers.
            </p>
          </div>
        </div>
      </FadeIn>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c, i) => (
          <FadeIn key={c.slug} delay={i * 0.05}>
            <Link
              href={`/g/${game.slug}/${c.slug}`}
              className="card-hover group flex items-center gap-3 rounded-2xl panel p-4 sm:p-5"
            >
              <div>
                <div className="text-[15px] font-bold">{c.name}</div>
                <div className="mt-1 text-[11.5px] muted">{c.blurb}</div>
              </div>
              <ArrowRight
                size={16}
                className="ml-auto text-brand-500 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </FadeIn>
        ))}
      </div>

      {blocks.map(({ cat, products }) =>
        products.length ? (
          <div key={cat.slug} className="mt-6 rounded-2xl panel p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-bold">
                {game.name} {cat.name}
              </h2>
              <Link href={`/g/${game.slug}/${cat.slug}`} className="text-[12px] font-medium text-brand-500">
                See All →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {products.slice(0, 6).map((p, i) => (
                <ProductCard key={p.id} p={p} i={i} />
              ))}
            </div>
          </div>
        ) : null
      )}
    </main>
  );
}
