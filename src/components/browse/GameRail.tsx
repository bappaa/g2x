"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, LayoutGrid, X } from "lucide-react";
import { AnyLogo } from "@/components/BrandIcon";
import { gameArt } from "@/lib/gameart";

const cats = [
  { slug: "top-up", name: "Top Up" },
  { slug: "currency", name: "Currency" },
  { slug: "accounts", name: "Accounts" },
  { slug: "items", name: "Items" },
  { slug: "boosting", name: "Boosting" },
  { slug: "subscriptions", name: "Subscriptions" },
];

type Game = { slug: string; name: string; logo: string };

/**
 * Games + categories navigator.
 *
 * Desktop  → sticky left sidebar.
 * Mobile   → a compact "current game" bar that opens a bottom sheet, plus a
 *            horizontally scrollable category strip. This stops the full game
 *            list from pushing the actual products far below the fold.
 */
export default function GameRail({
  games,
  activeGame,
  activeCategory,
}: {
  games: Game[];
  activeGame?: string;
  activeCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = games.find((g) => g.slug === activeGame);

  return (
    <>
      {/* ---------------------------- mobile ---------------------------- */}
      <div className="min-w-0 space-y-2.5 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full min-w-0 items-center gap-2.5 rounded-xl panel px-3 py-2.5 text-left active:scale-[.99]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg soft">
            {current ? <AnyLogo logo={current.logo} size={20} /> : <LayoutGrid size={14} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9.5px] uppercase tracking-wide muted">Game</span>
            <span className="block truncate text-[12.5px] font-bold">
              {current?.name ?? "All games"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-brand-600/15 px-2 py-1 text-[10.5px] font-semibold text-brand-400">
            Change <ChevronDown size={11} />
          </span>
        </button>

        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
          {cats.map((c) => {
            const on = activeCategory === c.slug;
            return (
              <Link
                key={c.slug}
                href={activeGame ? `/g/${activeGame}/${c.slug}` : `/c/${c.slug}`}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                  on
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-[var(--line)] soft muted"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {open && <GameSheet games={games} activeGame={activeGame} activeCategory={activeCategory} onClose={() => setOpen(false)} />}
      </AnimatePresence>

      {/* ---------------------------- desktop --------------------------- */}
      <aside className="hidden space-y-4 lg:sticky lg:top-[130px] lg:block lg:self-start">
        <div className="rounded-2xl panel p-4">
          <div className="mb-3 text-[13px] font-bold">All Games</div>
          <GameList games={games} activeGame={activeGame} activeCategory={activeCategory} max="max-h-[340px]" />
        </div>

        <div className="rounded-2xl panel p-4">
          <div className="mb-3 text-[13px] font-bold">Category</div>
          <div className="space-y-1">
            {cats.map((c) => (
              <Link
                key={c.slug}
                href={activeGame ? `/g/${activeGame}/${c.slug}` : `/c/${c.slug}`}
                className={`block rounded-lg px-2.5 py-1.5 text-[12.5px] transition-all hover:bg-brand-600/10 hover:pl-3.5 ${
                  activeCategory === c.slug ? "font-semibold text-brand-400" : "muted"
                }`}
              >
                • {c.name}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function GameSheet({
  games, activeGame, activeCategory, onClose,
}: {
  games: Game[]; activeGame?: string; activeCategory?: string; onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-end bg-black/70 backdrop-blur-sm lg:hidden"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[82vh] w-full rounded-t-2xl border-t border-[var(--line)] bg-[var(--panel)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)]" />
        <div className="mb-3 flex items-center">
          <div className="text-[14px] font-black">Choose a game</div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft" aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <GameList
          games={games}
          activeGame={activeGame}
          activeCategory={activeCategory}
          max="max-h-[58vh]"
          onPick={onClose}
        />
      </motion.div>
    </motion.div>
  );
}

function GameList({
  games, activeGame, activeCategory, max, onPick,
}: {
  games: Game[]; activeGame?: string; activeCategory?: string; max: string; onPick?: () => void;
}) {
  const [q, setQ] = useState("");
  const list = games.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--line)] soft px-2.5 py-2">
        <Search size={13} className="muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games..."
          className="w-full bg-transparent text-[12px] outline-none placeholder:text-[var(--muted)]"
        />
      </div>
      <div className={`no-scrollbar space-y-1 overflow-y-auto ${max}`}>
        {list.map((g) => (
          <Link
            key={g.slug}
            href={`/g/${g.slug}/${activeCategory ?? "top-up"}`}
            onClick={onPick}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-all hover:bg-brand-600/10 lg:hover:pl-3.5 ${
              activeGame === g.slug ? "bg-brand-600/15 font-semibold text-brand-400" : ""
            }`}
          >
            {g.logo ? (
              <AnyLogo logo={g.logo} size={20} />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={gameArt(g.slug, g.name)} alt="" width={20} height={20} className="shrink-0 rounded" />
            )}
            <span className="truncate">{g.name}</span>
          </Link>
        ))}
        {!list.length && <div className="py-4 text-center text-[11.5px] muted">No games found</div>}
      </div>
    </>
  );
}
