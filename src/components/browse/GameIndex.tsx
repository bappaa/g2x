"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Search, TrendingUp } from "lucide-react";
import { AnyLogo } from "@/components/BrandIcon";
import { useT } from "@/components/LocaleProvider";
import { img } from "@/lib/img";
import { resolveLogo } from "@/lib/gameart";

export type IndexGame = {
  slug: string;
  name: string;
  logo: string;
  offers: number;
  sold: number;
};

/** Numbers first, then A-Z — the same collation the SQL uses. */
const bucketOf = (name: string) => {
  const c = (name.trim()[0] ?? "#").toUpperCase();
  if (c >= "0" && c <= "9") return "0-9";
  if (c >= "A" && c <= "Z") return c;
  return "#";
};

function GameTile({ g, href }: { g: IndexGame; href: string }) {
  // Generated tiles inline as data URIs — a 115-game index makes no requests.
  const logo = resolveLogo(g.logo, g.slug, g.name);
  const isImage = logo.startsWith("/") || logo.startsWith("http") || logo.startsWith("data:");
  return (
    <Link href={href} className="group block">
      <div className="tile relative aspect-square w-full overflow-hidden border border-[var(--line)] soft transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand-500/70 group-hover:shadow-[0_16px_36px_-20px_rgba(139,61,255,.95)]">
        {isImage ? (
          logo.startsWith("data:image/svg+xml") ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
          <Image
            src={img(logo)}
            alt={g.name}
            fill
            sizes="(max-width:640px) 33vw, 140px"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          )
        ) : (
          <div className="grid h-full w-full place-items-center transition-transform duration-500 group-hover:scale-110">
            <AnyLogo logo={logo} size={44} />
          </div>
        )}
      </div>
      <div className="mt-2 truncate text-center text-[11px] font-medium transition-colors group-hover:text-brand-500">
        {g.name}
      </div>
    </Link>
  );
}

/**
 * Category game browser.
 *
 * Two sections, both fed by the same server query so nothing here needs admin
 * curation:
 *   - "Trending now" — the highest real sales volume in this category.
 *   - the full index — every game, numbers first then A-Z, with a search box
 *     and a clickable letter bar that jumps to a bucket.
 */
export default function GameIndex({
  games,
  category,
}: {
  games: IndexGame[];
  category: string;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  const trending = useMemo(
    () =>
      [...games]
        .filter((g) => g.sold > 0)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 5),
    [games]
  );

  // Letters that actually have games behind them.
  const letters = useMemo(() => {
    const set = new Set(games.map((g) => bucketOf(g.name)));
    const out: string[] = [];
    if (set.has("0-9")) out.push("0-9");
    for (let i = 65; i <= 90; i++) {
      const c = String.fromCharCode(i);
      if (set.has(c)) out.push(c);
    }
    if (set.has("#")) out.push("#");
    return out;
  }, [games]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return games.filter(
      (g) => (!s || g.name.toLowerCase().includes(s)) && (!letter || bucketOf(g.name) === letter)
    );
  }, [games, q, letter]);

  if (!games.length) return null;

  return (
    <div className="space-y-5">
      {trending.length > 0 && (
        <section className="rounded-2xl panel p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold">
            <TrendingUp size={15} className="text-brand-500" />
            {t("cat.trending", "Trending now")}
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {trending.map((g, i) => (
              <motion.div
                key={g.slug}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.05, 0.25), duration: 0.35 }}
              >
                <GameTile g={g} href={`/g/${g.slug}/${category}`} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex h-11 items-center gap-2.5 rounded-xl border border-[var(--line)] px-4 soft transition-all focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_rgba(139,61,255,.14)]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${t("cat.searchBy", "Search by")} ${games.length} ${t("cat.games", "games")}`}
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]"
          />
          <Search size={16} className="muted shrink-0" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5">
          <button
            type="button"
            onClick={() => setLetter(null)}
            className={`rounded-md px-2 py-1 text-[11.5px] font-bold transition-colors ${
              letter === null ? "bg-brand-600 text-white" : "muted hover:text-brand-500"
            }`}
          >
            {t("cat.all", "All")}
          </button>
          {letters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLetter((v) => (v === l ? null : l))}
              className={`rounded-md px-2 py-1 text-[11.5px] font-bold transition-colors ${
                letter === l ? "bg-brand-600 text-white" : "muted hover:text-brand-500"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mt-4 divide-y divide-[var(--line)]">
          {filtered.length ? (
            filtered.map((g) => (
              <Link
                key={g.slug}
                href={`/g/${g.slug}/${category}`}
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-brand-600/[.06]"
              >
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg soft">
                  {(() => {
                    const lg = resolveLogo(g.logo, g.slug, g.name);
                    if (lg.startsWith("data:image/svg+xml"))
                      /* eslint-disable-next-line @next/next/no-img-element */
                      return <img src={lg} alt="" className="h-full w-full object-cover" />;
                    if (lg.startsWith("/") || lg.startsWith("http"))
                      return <Image src={img(lg)} alt={g.name} fill sizes="36px" className="object-cover" />;
                    return (
                      <span className="grid h-full w-full place-items-center">
                        <AnyLogo logo={lg} size={20} />
                      </span>
                    );
                  })()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold transition-colors group-hover:text-brand-500">
                    {g.name}
                  </span>
                  <span className="block text-[10.5px] muted">
                    {g.offers} {g.offers === 1 ? t("cat.offer", "offer") : t("cat.offers", "offers")}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <div className="py-10 text-center text-[12.5px] muted">
              {t("cat.noGames", "No games match that search.")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
