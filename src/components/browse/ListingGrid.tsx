"use client";
import { useMoney } from "@/components/LocaleProvider";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Clock, Rocket } from "lucide-react";
import { Pill, inputCls } from "@/components/ui";

import type { DbListing } from "@/lib/queries";

const tiers = ["All", "Low End", "Mid End", "High End"] as const;

export default function ListingGrid({
  listings,
  category,
}: {
  listings: DbListing[];
  category: string;
}) {
  const money = useMoney();
  const [tier, setTier] = useState<(typeof tiers)[number]>("All");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sort, setSort] = useState("Recommended");

  const list = useMemo(() => {
    let l = [...listings];
    if (category === "accounts" && tier !== "All") l = l.filter((a) => a.tier === tier);
    if (min) l = l.filter((a) => a.price >= +min);
    if (max) l = l.filter((a) => a.price <= +max);
    if (sort === "Cheapest First") l.sort((a, b) => a.price - b.price);
    if (sort === "Highest Rated") l.sort((a, b) => b.rating - a.rating);
    if (sort === "Highest Level") l.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    return l;
  }, [listings, tier, min, max, sort, category]);

  if (category === "boosting")
    return (
      <div className="rounded-2xl panel p-4 sm:p-5">
        <h2 className="mb-4 text-[14px] font-bold">Boosting Services ({list.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 6) * 0.05 }}
            >
              <Link
                href={`/g/${b.game_slug}/boosting/${b.id}`}
                className="card-hover group flex items-center gap-4 rounded-2xl border border-[var(--line)] soft p-4"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  <Image src={b.image} alt="" fill sizes="50px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{b.title}</div>
                  <div className="mt-0.5 truncate text-[11.5px] muted">{b.description}</div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] muted">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {b.delivery_time}
                    </span>
                    <span className="flex items-center gap-1 text-brand-400">
                      <Rocket size={11} /> {b.store_name}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] muted">from</div>
                  <div className="text-[15px] font-black text-brand-500">{money(b.price)}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        {!list.length && (
          <div className="py-10 text-center text-[12.5px] muted">No boosting services listed yet.</div>
        )}
      </div>
    );

  return (
    <div className="rounded-2xl panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {tiers.map((t) => (
            <Pill key={t} active={tier === t} onClick={() => setTier(t)}>
              {t}
            </Pill>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="$ Min" className={`${inputCls} w-[74px] px-2 py-1.5`} />
          <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="$ Max" className={`${inputCls} w-[74px] px-2 py-1.5`} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} w-[150px] py-1.5`}>
            {["Recommended", "Cheapest First", "Highest Rated", "Highest Level"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 6) * 0.05 }}
          >
            <Link
              href={`/g/${a.game_slug}/accounts/${a.id}`}
              className="card-hover group block overflow-hidden rounded-2xl border border-[var(--line)] soft"
            >
              <div className="relative h-[132px] w-full overflow-hidden">
                <Image src={a.image} alt={a.title} fill sizes="320px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                {a.tier && (
                  <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9.5px] font-semibold text-white backdrop-blur">
                    {a.tier}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="text-[12.5px] font-bold">{a.title}</div>
                <div className="mt-0.5 text-[11px] muted">
                  Level {a.level} | {a.outfits} Outfits
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[15px] font-black text-brand-500">{money(a.price)}</span>
                  <span className="flex items-center gap-1 text-[10.5px] muted">
                    {a.store_name}
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    {a.rating}%
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {!list.length && (
        <div className="py-10 text-center text-[12.5px] muted">No accounts match your filters.</div>
      )}
    </div>
  );
}
