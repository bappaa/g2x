"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, ChevronLeft, Search, X } from "lucide-react";
import { AnyLogo } from "./BrandIcon";
import { useT } from "./LocaleProvider";
import { img } from "@/lib/img";
import { resolveLogo } from "@/lib/gameart";

export type MenuGame = { slug: string; name: string; logo: string; href: string };
export type MenuCategory = { slug: string; name: string; popular: MenuGame[]; all: MenuGame[] };

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** Small square game icon. Falls back to the brand-glyph renderer. */
function GameIcon({ logo, name, slug, size = 22 }: {
  logo: string; name: string; slug?: string; size?: number;
}) {
  // Inline data URI = no request. The mega-menu lists every game in a category.
  const src = resolveLogo(logo, slug || name, name);
  if (src.startsWith("data:image/svg+xml")) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-md" />;
  }
  const isImage = src.startsWith("/") || src.startsWith("http") || src.startsWith("data:");
  if (!isImage) return <AnyLogo logo={src} size={size} />;
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-md"
      style={{ width: size, height: size }}
    >
      <Image src={img(src)} alt={name} fill sizes={`${size}px`} className="object-cover" />
    </span>
  );
}

function GameRow({ g, onClick }: { g: MenuGame; onClick?: () => void }) {
  return (
    <Link
      href={g.href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[12.5px] transition-colors hover:bg-brand-600/10 hover:text-brand-400"
    >
      <GameIcon logo={g.logo} name={g.name} slug={g.slug} />
      <span className="truncate">{g.name}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop: hover/click mega-menu                                      */
/* ------------------------------------------------------------------ */

/**
 * One category dropdown. Opens on hover (pointer) and on click/keyboard, so
 * it stays reachable without a mouse. The panel is anchored to the header, not
 * the trigger, so wide menus never overflow the viewport.
 */
function DesktopMenu({
  cat,
  open,
  onOpen,
  onClose,
}: {
  cat: MenuCategory;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? cat.all.filter((g) => g.name.toLowerCase().includes(s)) : cat.all;
  }, [q, cat.all]);

  const label = t(`cat.${cat.slug}`, cat.name);

  return (
    <div className="static" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? onClose() : onOpen())}
        className={`flex items-center gap-1 whitespace-nowrap py-1.5 text-[13px] font-medium transition-colors hover:text-brand-500 ${
          open ? "text-brand-500" : ""
        }`}
      >
        {label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full z-[90] mx-auto max-w-[1220px] px-3 sm:px-4"
          >
            <div className="grid grid-cols-[1fr_320px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
              {/* Popular */}
              <div className="p-4">
                <div className="mb-2.5 text-[12.5px] font-bold">{t("nav.popularGames", "Popular games")}</div>
                {cat.popular.length ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {cat.popular.map((g) => (
                      <GameRow key={g.slug} g={g} onClick={onClose} />
                    ))}
                  </div>
                ) : (
                  <div className="px-2 py-6 text-[12px] muted">{t("nav.noGames", "Nothing here yet.")}</div>
                )}
                <Link
                  href={`/c/${cat.slug}`}
                  onClick={onClose}
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-400 transition-colors hover:text-brand-300"
                >
                  {t("home.seeAll")} {label}
                  <ChevronRight size={13} />
                </Link>
              </div>

              {/* All games, searchable */}
              <div className="border-l border-[var(--line)] p-4">
                <div className="mb-2.5 text-[12.5px] font-bold">{t("nav.allGames", "All games")}</div>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 soft transition-all focus-within:border-brand-500">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("nav.searchGame", "Search for game")}
                    className="w-full min-w-0 bg-transparent text-[12px] outline-none placeholder:text-[var(--muted)]"
                  />
                  <Search size={14} className="muted shrink-0" />
                </div>
                <div className="mt-2 max-h-[264px] overflow-y-auto pr-1">
                  {filtered.length ? (
                    filtered.map((g) => <GameRow key={g.slug} g={g} onClick={onClose} />)
                  ) : (
                    <div className="px-2 py-6 text-center text-[12px] muted">
                      {t("nav.noMatch", "No games match that search.")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The full desktop nav row: Home + a dropdown per category. */
export function DesktopNav({
  menu,
  homeHref = "/",
  homeActive,
}: {
  menu: MenuCategory[];
  homeHref?: string;
  homeActive?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <nav className="ml-1 hidden shrink-0 items-center gap-3.5 xl:flex 2xl:gap-4">
      <Link
        href={homeHref}
        className={`relative whitespace-nowrap py-1.5 text-[13px] font-medium transition-colors hover:text-brand-500 ${
          homeActive ? "text-brand-500" : ""
        }`}
      >
        {t("nav.home")}
        {homeActive && (
          <motion.span
            layoutId="navline"
            className="absolute -bottom-1 left-0 h-[2.5px] w-full rounded-full bg-brand-500"
          />
        )}
      </Link>

      {menu.map((c) => (
        <DesktopMenu
          key={c.slug}
          cat={c}
          open={open === c.slug}
          onOpen={() => setOpen(c.slug)}
          onClose={() => setOpen((v) => (v === c.slug ? null : v))}
        />
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: two-level drill-down                                        */
/* ------------------------------------------------------------------ */

/**
 * Mobile category browser: a flat category list that slides to a per-category
 * game list, with its own search. Rendered inside the existing mobile sheet.
 */
export function MobileCategoryNav({
  menu,
  onNavigate,
}: {
  menu: MenuCategory[];
  onNavigate?: () => void;
}) {
  const t = useT();
  const [active, setActive] = useState<MenuCategory | null>(null);
  const [q, setQ] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ("");
    scroller.current?.scrollTo({ top: 0 });
  }, [active]);

  const filtered = useMemo(() => {
    if (!active) return [];
    const s = q.trim().toLowerCase();
    return s ? active.all.filter((g) => g.name.toLowerCase().includes(s)) : active.all;
  }, [q, active]);

  if (!active) {
    return (
      <div className="space-y-1.5">
        {menu.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setActive(c)}
            className="flex w-full items-center justify-between rounded-xl soft px-3.5 py-3 text-left text-[13.5px] font-medium transition-colors hover:bg-brand-600/10"
          >
            {t(`cat.${c.slug}`, c.name)}
            <ChevronRight size={16} className="muted" />
          </button>
        ))}
      </div>
    );
  }

  const label = t(`cat.${active.slug}`, active.name);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActive(null)}
          aria-label="Back to categories"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg soft transition-colors hover:bg-brand-600/10"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 truncate text-center text-[13.5px] font-bold">{label}</div>
        <span className="h-8 w-8 shrink-0" />
      </div>

      <div className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 soft focus-within:border-brand-500">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("nav.searchGame", "Search for game")}
          className="w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--muted)]"
        />
        <Search size={14} className="muted shrink-0" />
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Link
          href={`/c/${active.slug}`}
          onClick={onNavigate}
          className="mb-1.5 flex items-center justify-between rounded-lg bg-brand-600/10 px-2.5 py-2 text-[12.5px] font-semibold text-brand-400"
        >
          {t("home.seeAll")} {label}
          <ChevronRight size={14} />
        </Link>

        {!q && active.popular.length > 0 && (
          <>
            <div className="px-2 pb-1 pt-2 text-[11px] font-bold muted">
              {t("nav.popularGames", "Popular games")}
            </div>
            {active.popular.map((g) => (
              <GameRow key={"p" + g.slug} g={g} onClick={onNavigate} />
            ))}
            <div className="px-2 pb-1 pt-3 text-[11px] font-bold muted">
              {t("nav.allGames", "All games")}
            </div>
          </>
        )}

        {filtered.length ? (
          filtered.map((g) => <GameRow key={g.slug} g={g} onClick={onNavigate} />)
        ) : (
          <div className="px-2 py-6 text-center text-[12px] muted">
            {t("nav.noMatch", "No games match that search.")}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export { X };
