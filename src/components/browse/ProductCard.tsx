"use client";
import { useMoney } from "@/components/LocaleProvider";
import Link from "next/link";
import Image from "next/image";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWishlist } from "./WishlistSync";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

import { toggleWishAction } from "@/lib/actions/shop";
import { img } from "@/lib/img";
import { gameArt } from "@/lib/gameart";

export type CardProduct = {
  id: string;
  slug: string;
  game_slug: string;
  category_slug: string;
  name: string;
  image: string;
  base_price: number;
  min_price?: number | null;
  popular?: number;
};

export default function ProductCard({
  p,
  i = 0,
  wished = false,
}: {
  p: CardProduct;
  i?: number;
  wished?: boolean;
}) {
  const money = useMoney();
  const href = `/g/${p.game_slug}/${p.category_slug}/${p.slug}`;
  // `wished` is the server hint (used where the page still renders per-user);
  // on cached pages it arrives from the shared client-side wishlist instead.
  const { ids, ready } = useWishlist();
  const [on, setOn] = useState(wished);
  useEffect(() => {
    if (ready) setOn(ids.has(p.id));
  }, [ready, ids, p.id]);
  const [, start] = useTransition();
  const router = useRouter();
  const price = p.min_price ?? p.base_price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (i % 6) * 0.05 }}
      className="relative min-w-0"
    >
      {p.popular === 1 && (
        <span className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-md bg-brand-600 px-2 py-0.5 text-[9.5px] font-bold text-white shadow-lg">
          Popular
        </span>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          const nextState = !on;
          setOn(nextState);
          start(async () => {
            const r = await toggleWishAction({
              id: p.id,
              title: p.name,
              sub: p.game_slug,
              image: p.image,
              price,
              href,
            });
            if (!r.ok) {
              setOn(!nextState);
              if (r.error === "AUTH") router.push("/login?next=" + href);
            }
          });
        }}
        className="absolute right-2.5 top-2.5 z-20 grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] bg-[var(--panel)] transition-all hover:scale-110"
        aria-label="Add to wishlist"
      >
        <Heart size={13} className={on ? "fill-rose-500 text-rose-500" : "muted"} />
      </button>
      <Link
        href={href}
        className="card-hover group flex h-full min-w-0 flex-col items-center rounded-2xl panel px-3 py-5 text-center sm:px-4 sm:py-6"
      >
        <div className="relative h-[74px] w-[74px] overflow-hidden rounded-xl">
          <Image
            /* Bulk-created products inherit the game logo, which is empty for
               generated tiles — fall back to the same art the game uses so the
               grid never shows a blank square. */
            src={p.image ? img(p.image) : gameArt(p.game_slug ?? p.slug, p.name)}
            alt={p.name}
            fill
            sizes="90px"
            className="object-contain transition-transform duration-500 group-hover:scale-110"
          />
        </div>
        <div className="mt-3 line-clamp-2 w-full break-words text-[12.5px] font-semibold leading-tight sm:text-[13px]">
          {p.name}
        </div>
        <div className="mt-1 w-full truncate text-[11.5px] muted">
          from <span className="font-bold text-brand-500">{money(price)}</span>
        </div>
      </Link>
    </motion.div>
  );
}
