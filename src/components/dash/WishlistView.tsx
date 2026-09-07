"use client";
import { useMoney } from "@/components/LocaleProvider";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trash2 } from "lucide-react";
import { Empty, Btn } from "@/components/ui";

import { toggleWishAction } from "@/lib/actions/shop";
import { img } from "@/lib/img";

type W = { item_id: string; title: string; subtitle: string; image: string; price: number; href: string };

export default function WishlistView({ items }: { items: W[] }) {
  const money = useMoney();
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [, start] = useTransition();

  const remove = (w: W) => {
    setRows((r) => r.filter((x) => x.item_id !== w.item_id));
    start(async () => {
      await toggleWishAction({ id: w.item_id, title: w.title, sub: w.subtitle, image: w.image, price: w.price, href: w.href });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Wishlist</h1>
      {rows.length === 0 ? (
        <Empty
          title="Your wishlist is empty"
          sub="Tap the heart on any product to save it for later."
          action={<Link href="/"><Btn>Browse marketplace</Btn></Link>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {rows.map((w) => (
              <motion.div
                key={w.item_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex gap-3 rounded-2xl panel p-3"
              >
                <Link href={w.href} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl soft">
                  <Image src={img(w.image)} alt={w.title} fill sizes="64px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={w.href} className="line-clamp-1 text-[12.5px] font-bold hover:text-brand-500">
                    {w.title}
                  </Link>
                  <div className="text-[11px] muted">{w.subtitle}</div>
                  <div className="mt-1 text-[14px] font-black text-brand-500">{money(w.price)}</div>
                </div>
                <button
                  onClick={() => remove(w)}
                  aria-label="Remove from wishlist"
                  className="h-fit rounded-lg p-2 text-rose-400 transition-colors hover:bg-rose-500/10"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {rows.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11.5px] muted">
          <Heart size={12} className="fill-rose-500 text-rose-500" /> {rows.length} saved item
          {rows.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
