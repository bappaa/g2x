"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus, Search, Pause, Play, Trash2, Pencil, Loader2, TrendingDown, TrendingUp, Link2, Check,
} from "lucide-react";
import { Btn, Empty, Tag, inputCls } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { img } from "@/lib/img";
import { useMoney } from "@/components/LocaleProvider";
import {
  offerStatusAction, offerStockAction, deleteOfferAction,
} from "@/lib/actions/seller";

type Offer = {
  id: string; product_id: string; product_name: string; product_slug?: string; game_slug?: string;
  image: string; game_name: string;
  category_name: string; category_slug: string; price: number; old_price: number | null;
  stock: number; delivery_time: string; delivery_method: string | null; login_method: string | null;
  region: string | null; platform: string | null; instructions: string | null;
  status: string; featured: number; sold_count: number; market_min: number | null;
  custom_fields: string | null;
};

const TABS = ["all", "active", "paused", "out_of_stock", "draft"];

export default function OffersView({
  offers, fields, status, category = "", page = 1, perPage = 30, total = 0,
}: {
  offers: Offer[]; fields: any[]; status: string;
  page?: number; perPage?: number; total?: number;
  category?: string;
}) {
  const money = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, start] = useTransition();

  const rows = offers.filter(
    (o) =>
      !q ||
      o.product_name.toLowerCase().includes(q.toLowerCase()) ||
      o.game_name.toLowerCase().includes(q.toLowerCase())
  );

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const copyLink = async (o: Offer) => {
    // Product page with offer id so buyer can find and buy this specific offer
    const game = (o as any).game_slug || "game";
    const cat = o.category_slug || "category";
    const slug = (o as any).product_slug || o.product_id;
    const url = `${window.location.origin}/g/${game}/${cat}/${slug}?offer=${o.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(o.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      prompt("Copy this link:", url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">
          {category
            ? offers[0]?.category_name ??
              category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "My Offers"}
        </h1>
        <Link
          href={category ? `/seller/sell/${category}` : "/seller/sell"}
          prefetch
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-brand-500"
        >
          <Plus size={14} /> New offer
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={
              t === "all"
                ? category
                  ? `/seller/offers?cat=${category}`
                  : "/seller/offers"
                : `/seller/offers?status=${t}${category ? `&cat=${category}` : ""}`
            }
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
              status === t ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
            }`}
          >
            {label(t)}
          </Link>
        ))}
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search offers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty
          title="No offers here"
          sub="Create an offer on any catalog product and set your own price, stock and delivery time."
          action={
            <Link
              href={category ? `/seller/sell/${category}` : "/seller/sell"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-brand-500"
            >
              <Plus size={14} /> New offer
            </Link>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((o) => {
            const beat = o.market_min != null && o.price <= o.market_min;
            return (
              <motion.div key={o.id} layout className="rounded-2xl panel p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg soft">
                    <Image src={img(o.image)} alt="" fill sizes="48px" className="object-cover" />
                  </div>
                  <div className="min-w-[170px] flex-1">
                    <div className="line-clamp-1 text-[13px] font-bold">{o.product_name}</div>
                    <div className="text-[11px] muted">
                      {o.game_name} · {o.category_name} · {o.sold_count} sold
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[15px] font-black text-brand-500">{money(o.price)}</div>
                    {o.market_min != null && (
                      <div className={`flex items-center justify-end gap-1 text-[10.5px] ${beat ? "text-emerald-400" : "text-amber-400"}`}>
                        {beat ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                        market {money(o.market_min)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] muted">Stock</span>
                    <input
                      type="number"
                      defaultValue={o.stock}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== o.stock) act(() => offerStockAction(o.id, v));
                      }}
                      className="w-[64px] rounded-lg border border-[var(--line)] soft px-2 py-1 text-[12px] outline-none focus:border-brand-500"
                    />
                  </div>

                  <Tag tone={statusTone(o.status)}>{label(o.status)}</Tag>

                  <div className="flex items-center gap-1">
                    <IconBtn
                      title={o.status === "active" ? "Pause" : "Activate"}
                      onClick={() => act(() => offerStatusAction(o.id, o.status === "active" ? "paused" : "active"))}
                    >
                      {o.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                    </IconBtn>
                    {/* Edit now goes to full page like image-1 */}
                    <Link
                      href={`/seller/offers/${o.id}/edit`}
                      title="Edit"
                      className="grid h-8 w-8 place-items-center rounded-lg soft transition-colors hover:bg-brand-500/15 hover:text-brand-400"
                    >
                      <Pencil size={13} />
                    </Link>
                    {/* Link replaces duplicate */}
                    <IconBtn
                      title={copiedId === o.id ? "Copied!" : "Copy product link"}
                      onClick={() => copyLink(o)}
                    >
                      {copiedId === o.id ? <Check size={13} className="text-emerald-400" /> : <Link2 size={13} />}
                    </IconBtn>
                    <IconBtn title="Delete" danger onClick={() => act(() => deleteOfferAction(o.id))}>
                      <Trash2 size={13} />
                    </IconBtn>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {total > perPage && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-[11.5px] muted">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <PageLink
              to={page - 1}
              disabled={page <= 1}
              status={status}
              category={category}
              label="Previous"
            />
            <span className="text-[11.5px] muted">
              {page} / {Math.ceil(total / perPage)}
            </span>
            <PageLink
              to={page + 1}
              disabled={page >= Math.ceil(total / perPage)}
              status={status}
              category={category}
              label="Next"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({
  to, disabled, status, category, label,
}: {
  to: number; disabled: boolean; status: string; category: string; label: string;
}) {
  const qs = new URLSearchParams();
  if (status && status !== "all") qs.set("status", status);
  if (category) qs.set("cat", category);
  if (to > 1) qs.set("page", String(to));
  const href = `/seller/offers${qs.toString() ? `?${qs}` : ""}`;

  if (disabled)
    return (
      <span className="cursor-not-allowed rounded-lg soft px-3 py-1.5 text-[12px] font-semibold opacity-40">
        {label}
      </span>
    );
  return (
    <Link
      href={href}
      scroll
      className="rounded-lg soft px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-brand-600/10 hover:text-brand-400"
    >
      {label}
    </Link>
  );
}

function IconBtn({
  children, onClick, title, danger,
}: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg soft transition-colors ${
        danger ? "hover:bg-rose-500/15 hover:text-rose-400" : "hover:bg-brand-500/15 hover:text-brand-400"
      }`}
    >
      {children}
    </button>
  );
}
