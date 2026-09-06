"use client";
import { useMoney } from "@/components/LocaleProvider";
import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ShieldCheck, Star, Loader2, AlertCircle, Clock } from "lucide-react";
import { Breadcrumb, Btn, Tag } from "@/components/ui";

import { addToCartAction } from "@/lib/actions/shop";
import type { DbGame, DbCategory, DbListing } from "@/lib/queries";

export default function ListingDetail({
  game,
  category,
  listing,
}: {
  game: DbGame;
  category: DbCategory;
  listing: DbListing;
}) {
  const money = useMoney();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [, start] = useTransition();
  const isAccount = category.slug === "accounts";

  const add = (go: boolean) => {
    setErr("");
    setBusy(true);
    start(async () => {
      const r = await addToCartAction({ listingId: listing.id, qty: 1 });
      setBusy(false);
      if (!r.ok) {
        if (r.error === "AUTH")
          router.push("/login?next=" + encodeURIComponent(`/g/${game.slug}/${category.slug}/${listing.id}`));
        else setErr(r.error || "Could not add to cart.");
        return;
      }
      router.refresh();
      if (go) router.push("/checkout");
    });
  };

  return (
    <main className="mx-auto max-w-[1220px] px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: category.name, href: `/c/${category.slug}` },
          { label: game.name, href: `/g/${game.slug}/${category.slug}` },
          { label: listing.title },
        ]}
      />

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="rounded-2xl panel p-4 sm:p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative h-[280px] w-full overflow-hidden rounded-xl"
            >
              <Image src={listing.image} alt={listing.title} fill sizes="800px" className="object-cover" />
              {listing.tier && (
                <span className="absolute right-3 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  {listing.tier}
                </span>
              )}
            </motion.div>

            <h1 className="mt-4 text-[19px] font-black sm:text-[24px] tracking-tight">{listing.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Tag>{game.name}</Tag>
              {isAccount && listing.level ? <Tag tone="slate">Level {listing.level}</Tag> : null}
              {isAccount && listing.outfits ? <Tag tone="slate">{listing.outfits} Outfits</Tag> : null}
              <Tag tone="green">{listing.verified ? "Verified Seller" : "Active Seller"}</Tag>
            </div>

            <p className="mt-4 text-[12.5px] leading-relaxed muted">{listing.description}</p>
          </div>

          <div className="rounded-2xl panel p-4 sm:p-5">
            <h3 className="mb-3 text-[14px] font-bold">What&apos;s included</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(isAccount
                ? [
                    "Original email + password",
                    "Full recovery access",
                    `${listing.outfits ?? 0} outfits & skins`,
                    "No ban history",
                    "Warranty on access",
                    "Instant credential delivery",
                  ]
                : [
                    "Hand-played by pro boosters (no cheats)",
                    "Offline / appear-invisible mode",
                    "Live progress tracking",
                    "Priority chat with your booster",
                    "Full account safety guarantee",
                    "Money back if not completed",
                  ]
              ).map((t) => (
                <div key={t} className="flex items-center gap-2 text-[12.5px]">
                  <Check size={13} className="text-emerald-400" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-[130px] lg:self-start">
          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="text-[11.5px] muted">Price</div>
            <div className="mt-1 text-[18px] font-black sm:text-[30px] text-brand-500">{money(listing.price)}</div>
            <div className="mt-3 flex items-center gap-2 rounded-lg soft px-3 py-2 text-[12px]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[10px] font-bold text-white">
                {listing.store_name.slice(0, 1)}
              </span>
              <span className="font-semibold">{listing.store_name}</span>
              <span className="ml-auto flex items-center gap-1 muted">
                <Star size={11} className="fill-amber-400 text-amber-400" /> {listing.rating}%
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] muted">
              <Clock size={12} /> Delivery {listing.delivery_time} · {listing.stock} in stock
            </div>

            {err && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
                <AlertCircle size={13} /> {err}
              </div>
            )}

            <Btn className="mt-3 flex w-full items-center justify-center gap-2" disabled={busy} onClick={() => add(true)}>
              {busy && <Loader2 size={14} className="animate-spin" />} Buy Now
            </Btn>
            <Btn variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => add(false)}>
              Add to Cart
            </Btn>
          </div>

          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold">
              <ShieldCheck size={15} className="text-emerald-400" /> Buyer Protection
            </div>
            {["100% Secure Transactions", "Money-back Guarantee", "24/7 Live Support"].map((t) => (
              <div key={t} className="flex items-center gap-2 py-1 text-[12px]">
                <Check size={13} className="text-emerald-400" /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
