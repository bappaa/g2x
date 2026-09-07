"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { AnyLogo } from "./BrandIcon";
import { CategoryIcon } from "./CategoryIcon";
import { useT } from "./LocaleProvider";
import { img } from "@/lib/img";

export type Tile = { label: string; logo: string; href: string; badge?: string };
export type Rail = { slug: string; name: string; icon: string; tiles: Tile[]; wide?: boolean };

function TileView({ t, i }: { t: Tile; i: number }) {
  const isImage = t.logo?.startsWith("/") || t.logo?.startsWith("http") || t.logo?.startsWith("/api/");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: Math.min(i * 0.04, 0.24), duration: 0.35 }}
    >
      <Link href={t.href} className="group block">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--soft,rgba(255,255,255,.03))] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand-500/70 group-hover:shadow-[0_16px_36px_-20px_rgba(139,61,255,.95)]">
          {isImage ? (
            <Image
              src={img(t.logo)}
              alt={t.label}
              fill
              sizes="(max-width: 640px) 33vw, 160px"
              unoptimized={t.logo.startsWith("/api/")}
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="grid h-full w-full place-items-center p-3 transition-transform duration-500 group-hover:scale-110">
              <AnyLogo logo={t.logo} size={44} />
            </div>
          )}
          {t.badge && (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-brand-600 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
              {t.badge}
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <div className="mt-1.5 truncate text-center text-[10.5px] font-medium leading-tight transition-colors group-hover:text-brand-400 sm:text-[11px]">
          {t.label}
        </div>
      </Link>
    </motion.div>
  );
}

function Block({ rail }: { rail: Rail }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 sm:p-4"
    >
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-bold sm:text-[14px]">
          <CategoryIcon name={rail.icon} slug={rail.slug} size={15} />
          <span className="truncate">{t("home.popularIn")} {t(`cat.${rail.slug}`, rail.name)}</span>
        </div>
        <Link
          href={`/c/${rail.slug}`}
          className="group flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-brand-400 transition-colors hover:text-brand-300"
        >
          {t("home.seeAll")}
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div
        className={
          rail.wide
            ? "grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7"
            : "grid grid-cols-3 gap-2.5 sm:grid-cols-5"
        }
      >
        {rail.tiles.map((t, i) => (
          <TileView key={t.href + i} t={t} i={i} />
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Popular-category rails. Every rail and every tile comes from the database
 * (`categories`, `games`, `game_categories`, `products`). Empty rails are
 * dropped, so clearing the catalog in admin clears this section.
 *
 * Rails stack in a single column (as in the approved design) so each row of
 * tiles gets the full page width and stays readable on phones.
 */
export default function Categories({ title, rails }: { title: string; rails: Rail[] }) {
  const filled = rails.filter((r) => r.tiles.length > 0);
  if (!filled.length) return null;

  return (
    <section className="mx-auto max-w-[1220px] px-3 sm:px-4">
      {title && (
        <div className="mb-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--line)]" />
          <h2 className="text-center text-[12px] font-bold tracking-[0.18em] sm:text-[14px]">
            {title}
          </h2>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--line)]" />
        </div>
      )}

      <div className="space-y-4">
        {filled.map((r) => (
          <Block key={r.slug} rail={r} />
        ))}
      </div>
    </section>
  );
}
