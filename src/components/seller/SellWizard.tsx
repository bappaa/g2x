"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Search, Info, ChevronDown, Plus } from "lucide-react";
import { AnyLogo } from "@/components/BrandIcon";
import { useMoney } from "@/components/LocaleProvider";
import { img } from "@/lib/img";
import { resolveLogo } from "@/lib/gameart";

export type WizGame = { slug: string; name: string; logo: string; products: number };
export type WizProduct = {
  id: string; name: string; image: string; base_price: number;
  region: string | null; platform: string | null; delivery_method: string | null;
  market_min: number | null; offer_count: number;
};

/** Breadcrumb shared by every step of the flow. */
export function SellCrumbs({
  category, categoryName, step, gameName,
}: {
  category: string; categoryName: string; step: 1 | 2 | 3; gameName?: string;
}) {
  const Item = ({ href, label, on }: { href?: string; label: string; on?: boolean }) =>
    href && !on ? (
      <Link href={href} className="transition-colors hover:text-brand-400">{label}</Link>
    ) : (
      <span className={on ? "font-bold" : ""}>{label}</span>
    );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] muted">
      <Item href="/seller/offers" label="My Offers" />
      <ChevronRight size={12} />
      <Item href={`/seller/offers?cat=${category}`} label={categoryName} on={step === 1} />
      {step >= 2 && (
        <>
          <ChevronRight size={12} />
          <Item href={`/seller/sell/${category}`} label="Select game" on={step === 2} />
        </>
      )}
      {step >= 3 && (
        <>
          <ChevronRight size={12} />
          <Item label={gameName ?? "Item delivery and price"} on />
        </>
      )}
    </div>
  );
}

/** Centred step header — "Sell Game Currency / Step 2/3". */
export function SellHeader({
  title, step, subtitle,
}: {
  title: string; step?: string; subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-5 text-center">
      <h1 className="text-[20px] font-black tracking-tight sm:text-[26px]">
        <span className="grad-text">{title}</span>
      </h1>
      {step && <div className="mt-1 text-[12.5px] muted">{step}</div>}
      {subtitle && <div className="mt-2 flex items-center justify-center gap-2">{subtitle}</div>}
    </div>
  );
}

/** Admin-authored notice, e.g. the accounts "5 day money hold system" card. */
export function SellNotice({ title, body }: { title: string | null; body: string | null }) {
  if (!body) return null;
  return (
    <div className="mb-5 rounded-xl border border-[var(--line)] soft p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
          <Info size={16} />
        </span>
        <div className="min-w-0">
          {title && <div className="text-[13.5px] font-bold">{title}</div>}
          <p className="mt-1.5 text-[12.5px] leading-relaxed muted">{body}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — choose game                                                */
/* ------------------------------------------------------------------ */

/**
 * Searchable game picker. A native <select> cannot show logos or a filter box
 * and gets unusable past ~50 entries, so this is a custom combobox over the
 * same data.
 */
export function GamePicker({
  games, category,
}: {
  games: WizGame[]; category: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<WizGame | null>(null);

  /**
   * Cap the rendered list.
   *
   * A category can hold 100+ games; painting them all into an open dropdown is
   * wasted work when only ~8 are visible. Searching narrows it, so 60 rows is
   * always more than enough to scroll through.
   */
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? games.filter((g) => g.name.toLowerCase().includes(s)) : games;
    return list.slice(0, 60);
  }, [q, games]);
  const hiddenCount = useMemo(() => {
    const s = q.trim().toLowerCase();
    const total = s ? games.filter((g) => g.name.toLowerCase().includes(s)).length : games.length;
    return Math.max(0, total - 60);
  }, [q, games]);

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="rounded-2xl panel p-5 sm:p-6">
        <h2 className="mb-4 text-center text-[15px] font-bold">Choose Game</h2>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-[13px] transition-all ${
              open ? "border-brand-500 shadow-[0_0_0_3px_rgba(139,61,255,.14)]" : "border-[var(--line)]"
            } soft`}
          >
            <span className={picked ? "" : "muted"}>{picked ? picked.name : "Select your game"}</span>
            <ChevronDown size={15} className={`muted transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl"
            >
              <div className="flex h-10 items-center gap-2 border-b border-[var(--line)] px-3">
                <Search size={14} className="muted shrink-0" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search for game"
                  className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[var(--muted)]"
                />
              </div>
              <div className="max-h-[280px] overflow-y-auto p-1">
                {rows.length ? (
                  rows.map((g) => (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => {
                        setPicked(g);
                        setOpen(false);
                        setQ("");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-brand-600/10"
                    >
                      <GameLogo logo={g.logo} name={g.name} slug={g.slug} />
                      <span className="min-w-0 flex-1 truncate">{g.name}</span>
                      <span className="shrink-0 text-[10.5px] muted">{g.products}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center text-[12px] muted">No games match that search.</div>
                )}
                {hiddenCount > 0 && (
                  <div className="px-3 py-2 text-center text-[11px] muted">
                    +{hiddenCount} more — type to narrow the list
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <Link
          href={`/seller/offers?cat=${category}`}
          className="rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-brand-600/10"
        >
          Back
        </Link>
        <button
          type="button"
          disabled={!picked}
          onClick={() => picked && router.push(`/seller/sell/${category}/${picked.slug}`)}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-[12.5px] font-bold text-white transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <p className="mt-4 text-center text-[12px] muted">
        Can&apos;t find the game you want to sell?{" "}
        <Link href="/support" className="text-brand-400 hover:underline">
          Contact our support
        </Link>{" "}
        to suggest a game.
      </p>
    </div>
  );
}

function GameLogo({ logo, name, slug, size = 22 }: {
  logo: string; name: string; slug?: string; size?: number;
}) {
  /**
   * Generated tiles are inlined as data URIs, so a 115-game picker costs zero
   * network requests. Plain <img> on purpose: next/image adds no value to an
   * inline SVG and would only add markup.
   */
  const src = resolveLogo(logo, slug || name, name);
  if (src.startsWith("data:image/svg+xml")) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-md" />
    );
  }
  const isImage = src.startsWith("/") || src.startsWith("http") || src.startsWith("data:");
  if (!isImage) return <AnyLogo logo={src} size={size} />;
  return (
    <span className="relative shrink-0 overflow-hidden rounded-md" style={{ width: size, height: size }}>
      <Image src={img(src)} alt={name} fill sizes={`${size}px`} className="object-cover" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — choose the admin-listed product                            */
/* ------------------------------------------------------------------ */

/**
 * Products for the chosen game, as listed by the admin. Sellers pick one and
 * then set their own price and stock — sellers never invent products, which is
 * what keeps offers comparable on the product page.
 */
export function ProductPicker({
  products, category, game, gameName,
}: {
  products: WizProduct[]; category: string; game: string; gameName: string;
}) {
  const money = useMoney();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => p.name.toLowerCase().includes(s)) : products;
  }, [q, products]);

  if (!products.length)
    return (
      <div className="mx-auto max-w-[720px] rounded-2xl panel p-8 text-center">
        <div className="text-[13.5px] font-bold">No products listed yet</div>
        <p className="mt-1.5 text-[12.5px] muted">
          The admin has not published any {gameName} products in this category yet.
        </p>
        <Link
          href={`/seller/sell/${category}`}
          className="mt-4 inline-block rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-brand-600/10"
        >
          Back
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-[820px]">
      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 soft focus-within:border-brand-500">
          <Search size={14} className="muted shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${products.length} products`}
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[var(--muted)]"
          />
        </div>

        <div className="divide-y divide-[var(--line)]">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/seller/sell/${category}/${game}/${p.id}`}
              className="group flex items-center gap-3 py-3 transition-colors hover:bg-brand-600/[.06]"
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg soft">
                <Image
                  src={img(p.image)}
                  alt={p.name}
                  fill
                  sizes="44px"
                  unoptimized={(p.image ?? "").startsWith("/api/")}
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold transition-colors group-hover:text-brand-500">
                  {p.name}
                </span>
                <span className="block text-[10.5px] muted">
                  {p.offer_count > 0
                    ? `${p.offer_count} live ${p.offer_count === 1 ? "offer" : "offers"} · from ${money(p.market_min)}`
                    : "Be the first to sell this"}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 muted transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
          {!rows.length && (
            <div className="py-10 text-center text-[12.5px] muted">No products match that search.</div>
          )}
        </div>
      </div>

      {/*
        Sellers are not limited to the admin's catalogue.

        Picking a pre-defined product keeps offers comparable on a shared
        product page, which is why it is the default. But a seller with, say,
        "100 UC" that nobody has listed yet would otherwise be stuck — so they
        can always describe their own offer instead.
      */}
      <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] p-4 text-center">
        <div className="text-[12.5px] font-semibold">Selling something not listed here?</div>
        <p className="mx-auto mt-1 max-w-[420px] text-[11.5px] muted">
          Create your own offer for {gameName} and describe exactly what you are selling.
        </p>
        <Link
          href={`/seller/sell/${category}/${game}/new`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-500"
        >
          <Plus size={14} /> Create my own offer
        </Link>
      </div>

      <div className="mt-5 text-center">
        <Link
          href={`/seller/sell/${category}`}
          className="inline-block rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-brand-600/10"
        >
          Back
        </Link>
      </div>
    </div>
  );
}
