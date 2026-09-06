import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Categories, { type Rail } from "@/components/Categories";
import Stats, { type StatItem } from "@/components/Stats";
import Testimonials from "@/components/Testimonials";
import BannerSlider from "@/components/BannerSlider";
import { activeBanners } from "@/lib/queries";
import {
  getBlocks, homeCategories, popularTiles, categoryBrands, liveStats, homeReviews,
} from "@/lib/homepage";

export const dynamic = "force-dynamic";

/**
 * The homepage renders nothing that is hardcoded. Every section reads from the
 * database, and each one hides itself when the admin has no content for it:
 *
 *   hero / trust / reviews / popular_* -> cms_blocks   (Admin → CMS Blocks)
 *   banners                            -> banners      (Admin → Banners)
 *   category rail + tiles              -> categories / games / products
 *   trust counters                     -> live COUNT()s over the real tables
 *   testimonials                       -> genuine reviews rows
 */
export default async function Home() {
  const [blocks, cats, hero, strip, stats, reviews] = await Promise.all([
    getBlocks(),
    homeCategories(),
    activeBanners("hero"),
    activeBanners("strip"),
    liveStats(),
    homeReviews(6),
  ]);

  /* ---------------- hero ---------------- */
  const h = blocks.hero;
  const heroPerks = (h?.items ?? [])
    .map((p) => ({ icon: String(p.icon ?? ""), label: String(p.label ?? p.t ?? "") }))
    .filter((p) => p.label);

  // Optional hero extras, all admin-editable rows on the same CMS block:
  //   { "badge": "..." }  and  { "deal": "...", "dealPrice": "...", "dealWas": "..." }
  const heroExtra = (h?.items ?? []) as Record<string, unknown>[];
  const pick = (k: string) => {
    const row = heroExtra.find((x) => x[k] !== undefined);
    return row ? String(row[k] ?? "") : "";
  };

  /* ---------------- category shortcuts ---------------- */
  const services = cats.map((c) => ({
    slug: c.slug,
    name: c.name,
    blurb: c.blurb ?? "",
    icon: c.icon ?? c.slug,
  }));

  /* ---------------- popular rails ---------------- */
  // One rail per active category that has a matching `popular_<slug>` CMS
  // block enabled. Subscriptions render as a wide brand strip.
  const railCats = cats.filter((c) => blocks[`popular_${c.slug.replace(/-/g, "")}`] || blocks[`popular_${c.slug}`]);
  const useCats = railCats.length ? railCats : cats;

  const rails: Rail[] = await Promise.all(
    useCats.map(async (c) => {
      const wide = c.slug === "subscriptions";
      const tiles = wide ? await categoryBrands(c.slug, 7) : await popularTiles(c.slug, 5);
      return { slug: c.slug, name: c.name, icon: c.icon ?? c.slug, tiles, wide };
    })
  );

  /* ---------------- trust bar ---------------- */
  const trust = blocks.trust;
  // Admin-written rows first, then live counters appended automatically.
  const copyStats: StatItem[] = (trust?.items ?? []).map((s, i) => ({
    key: `copy-${i}`,
    icon: String(s.icon ?? "shield"),
    value: String(s.value ?? s.title ?? ""),
    label: String(s.label ?? s.sub ?? ""),
  }));

  const liveItems: StatItem[] = [
    { key: "offers", icon: "star", value: "", n: stats.offers, suffix: "+", label: "Active Offers" },
    { key: "games", icon: "gamepad", value: "", n: stats.games, suffix: "+", label: "Games Supported" },
    { key: "sellers", icon: "shield", value: "", n: stats.sellers, suffix: "+", label: "Verified Sellers" },
    { key: "orders", icon: "zap", value: "", n: stats.orders, suffix: "+", label: "Orders Delivered" },
  ].filter((s) => (s.n ?? 0) > 0);

  const statItems = [...copyStats, ...liveItems];

  /* ---------------- reviews ---------------- */
  const rv = blocks.reviews;
  const avg = reviews.length
    ? (reviews.reduce((a, b) => a + Number(b.stars), 0) / reviews.length).toFixed(1)
    : "";

  return (
    <main>
      <BannerSlider banners={hero as never} />

      {h && (
        <Hero
          title={h.title}
          highlight={h.subtitle}
          body={h.body}
          image={h.image}
          perks={heroPerks}
          ctaLabel={h.ctaLabel}
          ctaHref={h.ctaHref}
          cta2Label={String(h.items.find((x) => x.cta2)?.cta2 ?? "")}
          cta2Href={String(h.items.find((x) => x.cta2href)?.cta2href ?? "")}
          badge={pick("badge")}
          dealLabel={pick("deal")}
          dealPrice={pick("dealPrice")}
          dealWas={pick("dealWas")}
        />
      )}

      <div className="space-y-10 pb-12 pt-2">
        <BannerSlider banners={strip as never} />
        <Services items={services} />
        <Categories title={blocks.popular_games?.title ?? "POPULAR CATEGORIES"} rails={rails} />
        {trust !== undefined && <Stats items={statItems} />}
        {rv !== undefined && (
          <Testimonials
            title={rv.title || "WHAT OUR CUSTOMERS SAY"}
            reviews={reviews.map((r) => ({
              id: r.id,
              name: r.name,
              stars: Number(r.stars),
              body: r.body,
            }))}
            rating={avg}
            count={reviews.length ? String(reviews.length) : undefined}
          />
        )}
      </div>
    </main>
  );
}
