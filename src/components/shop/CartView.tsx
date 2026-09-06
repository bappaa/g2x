"use client";
import { useMoney } from "@/components/LocaleProvider";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, ShieldCheck, Clock, Store } from "lucide-react";
import { Btn, Empty } from "@/components/ui";

import { setCartQtyAction, removeCartAction, clearCartAction } from "@/lib/actions/shop";

export type CartRow = {
  key: string; title: string; sub: string; image: string; store_name: string;
  price: number; qty: number; stock: number; delivery: string; href: string;
  /** Buyer's picks on the product page (region / server and delivery method). */
  opt_region?: string | null; opt_delivery?: string | null;
};

export default function CartView({ items }: { items: CartRow[] }) {
  const money = useMoney();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(items);

  const sync = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const setQty = (key: string, qty: number) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const q = Math.max(1, Math.min(row.stock, qty));
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, qty: q } : r)));
    sync(() => setCartQtyAction(key, q));
  };
  const remove = (key: string) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    sync(() => removeCartAction(key));
  };

  const subtotal = +rows.reduce((t, r) => t + r.price * r.qty, 0).toFixed(2);
  const fee = +(subtotal * 0.02).toFixed(2);
  const total = +(subtotal + fee).toFixed(2);

  if (!rows.length)
    return (
      <div className="mt-5">
        <Empty
          title="Your cart is empty"
          sub="Browse top-ups, currency, accounts and subscriptions from verified sellers."
          action={
            <Link href="/">
              <Btn>Start shopping</Btn>
            </Link>
          }
        />
      </div>
    );

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_330px]">
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.div
              key={r.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
              className="flex gap-4 rounded-2xl panel p-4"
            >
              <Link href={r.href} className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl soft">
                <Image src={r.image} alt={r.title} fill sizes="80px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={r.href} className="line-clamp-1 text-[13.5px] font-bold hover:text-brand-500">
                  {r.title}
                </Link>
                <div className="mt-0.5 text-[11.5px] muted">{r.sub}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] muted">
                  <span className="flex items-center gap-1">
                    <Store size={11} /> {r.store_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {r.delivery}
                  </span>
                </div>
                {(r.opt_region || r.opt_delivery) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[r.opt_region, r.opt_delivery].filter(Boolean).map((o) => (
                      <span
                        key={o as string}
                        className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] soft p-0.5">
                    <button
                      aria-label="Decrease"
                      onClick={() => setQty(r.key, r.qty - 1)}
                      className="grid h-6 w-6 place-items-center rounded hover:bg-brand-500/15"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-[12px] font-bold">{r.qty}</span>
                    <button
                      aria-label="Increase"
                      onClick={() => setQty(r.key, r.qty + 1)}
                      className="grid h-6 w-6 place-items-center rounded hover:bg-brand-500/15"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(r.key)}
                    className="flex items-center gap-1 text-[11.5px] muted hover:text-rose-400"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-black text-brand-500">{money(r.price * r.qty)}</div>
                <div className="mt-0.5 text-[10.5px] muted">{money(r.price)} each</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          onClick={() => {
            setRows([]);
            sync(clearCartAction);
          }}
          className="text-[11.5px] muted hover:text-rose-400"
        >
          Clear cart
        </button>
      </div>

      <div className="space-y-4 lg:sticky lg:top-[130px] lg:self-start">
        <div className="rounded-2xl panel p-4 sm:p-5">
          <h3 className="text-[14px] font-bold">Order Summary</h3>
          <div className="mt-3 space-y-2 text-[12.5px]">
            <Row l={`Subtotal (${rows.reduce((t, r) => t + r.qty, 0)} items)`} v={money(subtotal)} />
            <Row l="Service fee (2%)" v={money(fee)} />
            <div className="my-2 h-px bg-[var(--line)]" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold">Total</span>
              <span className="text-[20px] font-black text-brand-500">{money(total)}</span>
            </div>
          </div>
          <Btn className="mt-4 w-full" disabled={pending} onClick={() => router.push("/checkout")}>
            Proceed to Checkout
          </Btn>
          <div className="mt-3 flex items-center gap-2 text-[11px] muted">
            <ShieldCheck size={13} className="text-emerald-400" /> Escrow protected — sellers are paid
            only after you confirm delivery.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="muted">{l}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
