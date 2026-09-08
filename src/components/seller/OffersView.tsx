"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Pause, Play, Copy, Trash2, Pencil, X, Loader2, TrendingDown, TrendingUp, Check,
} from "lucide-react";
import { Btn, Empty, Field, Tag, inputCls } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { img } from "@/lib/img";
import { useMoney } from "@/components/LocaleProvider";
import {
  saveOfferAction, offerStatusAction, offerStockAction, deleteOfferAction, duplicateOfferAction,
} from "@/lib/actions/seller";

type Offer = {
  id: string; product_id: string; product_name: string; image: string; game_name: string;
  category_name: string; category_slug: string; price: number; old_price: number | null;
  stock: number; delivery_time: string; delivery_method: string | null; login_method: string | null;
  region: string | null; platform: string | null; instructions: string | null;
  status: string; featured: number; sold_count: number; market_min: number | null;
  custom_fields: string | null;
};
type Cat = {
  id: string; name: string; image: string; base_price: number; game_name: string;
  category_name: string; category_slug: string; market_min: number | null; offer_count: number;
};
type FT = { id: string; category_slug: string; label: string; field_key: string; field_type: string; options: string | null; required: number };

const TABS = ["all", "active", "paused", "out_of_stock", "draft"];

export default function OffersView({
  offers, catalog, fields, status, category = "",
}: {
  offers: Offer[]; catalog: Cat[]; fields: FT[]; status: string;
  /** Set by the sidebar's My Offers drawer; "" means all categories. */
  category?: string;
}) {
  const money = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Offer | null>(null);
  const [creating, setCreating] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">
          {category
            ? offers[0]?.category_name ??
              category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "My Offers"}
        </h1>
        {/* Creating goes through the guided wizard, which asks for whatever the
            admin configured for this category. The inline modal stays for edits. */}
        <Link
          href={category ? `/seller/sell/${category}` : "/seller/sell"}
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
          action={<Btn onClick={() => setCreating(true)}>Create your first offer</Btn>}
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
                    <IconBtn title="Edit" onClick={() => { setCreating(false); setEditing(o); }}>
                      <Pencil size={13} />
                    </IconBtn>
                    <IconBtn title="Duplicate" onClick={() => act(() => duplicateOfferAction(o.id))}>
                      <Copy size={13} />
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

      <AnimatePresence>
        {(creating || editing) && (
          <OfferModal
            offer={editing}
            catalog={catalog}
            fields={fields}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSaved={() => { setCreating(false); setEditing(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
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

function OfferModal({
  offer, catalog, fields, onClose, onSaved,
}: {
  offer: Offer | null; catalog: Cat[]; fields: FT[];
  onClose: () => void; onSaved: () => void;
}) {
  const money = useMoney();
  const [productId, setProductId] = useState(offer?.product_id ?? "");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const product = catalog.find((c) => c.id === productId);
  const catFields = useMemo(
    () => fields.filter((f) => f.category_slug === (product?.category_slug ?? "")),
    [fields, product]
  );
  let existing: Record<string, string> = {};
  try {
    existing = offer?.custom_fields ? JSON.parse(offer.custom_fields) : {};
  } catch {}

  const filtered = catalog
    .filter((c) => !q || `${c.game_name} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 40);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-[720px] overflow-y-auto rounded-2xl panel p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-[16px] font-black">{offer ? "Edit offer" : "New offer"}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>

        <form
          action={(fd) =>
            start(async () => {
              setErr("");
              const r = await saveOfferAction(fd);
              if (!r.ok) return setErr(r.error || "Could not save the offer.");
              onSaved();
            })
          }
          className="space-y-4"
        >
          <input type="hidden" name="id" value={offer?.id ?? ""} />
          <input type="hidden" name="productId" value={productId} />

          {!offer && (
            <div>
              <div className="mb-1.5 text-[11.5px] font-medium muted">1. Pick a catalog product</div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Search PUBG UC, Netflix, Valorant Points…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="mt-2 max-h-[180px] space-y-1 overflow-y-auto rounded-xl soft p-1.5">
                {filtered.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setProductId(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors ${
                      productId === c.id ? "bg-brand-600/20" : "hover:bg-brand-600/10"
                    }`}
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                      <Image src={img(c.image)} alt="" fill sizes="32px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[12px] font-semibold">{c.name}</div>
                      <div className="text-[10px] muted">
                        {c.game_name} · {c.category_name} · {c.offer_count} sellers
                      </div>
                    </div>
                    <div className="text-[11px] muted">
                      {c.market_min != null ? `from ${money(c.market_min)}` : `RRP ${money(c.base_price)}`}
                    </div>
                    {productId === c.id && <Check size={14} className="text-brand-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(product || offer) && (
            <>
              {product?.market_min != null && (
                <div className="rounded-lg bg-brand-600/10 px-3 py-2 text-[11.5px] text-brand-300">
                  Lowest live price for this product is <b>{money(product.market_min)}</b> across{" "}
                  {product.offer_count} sellers. Price below it to win the Buy Box.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Your price (USD)">
                  <input name="price" type="number" step="0.01" defaultValue={offer?.price} className={inputCls} required />
                </Field>
                <Field label="Compare-at price" hint="Optional strike-through">
                  <input name="oldPrice" type="number" step="0.01" defaultValue={offer?.old_price ?? ""} className={inputCls} />
                </Field>
                <Field label="Stock">
                  <input name="stock" type="number" defaultValue={offer?.stock ?? 10} className={inputCls} required />
                </Field>
                <Field label="Delivery time">
                  <input name="deliveryTime" defaultValue={offer?.delivery_time ?? "5 - 30 min"} className={inputCls} required />
                </Field>
                <Field label="Delivery method">
                  <select name="deliveryMethod" defaultValue={offer?.delivery_method ?? "Instant Code"} className={inputCls}>
                    {["Instant Code", "Account Details", "Player ID Top-up", "In-game Trade", "Manual Service"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue={offer?.status ?? "active"} className={inputCls}>
                    {["active", "paused", "draft"].map((m) => (
                      <option key={m} value={m}>{label(m)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Region">
                  <input name="region" defaultValue={offer?.region ?? "Global"} className={inputCls} />
                </Field>
                <Field label="Platform">
                  <input name="platform" defaultValue={offer?.platform ?? "All"} className={inputCls} />
                </Field>
                <Field label="Login method">
                  <input name="loginMethod" defaultValue={offer?.login_method ?? ""} className={inputCls} placeholder="Player ID / Email login" />
                </Field>
              </div>

              <Field label="Instructions for the buyer">
                <textarea
                  name="instructions"
                  rows={2}
                  defaultValue={offer?.instructions ?? ""}
                  className={inputCls}
                  placeholder="Send your player ID after checkout. Do not change your password for 24h."
                />
              </Field>

              {catFields.length > 0 && (
                <div>
                  <div className="mb-2 text-[11.5px] font-medium muted">
                    {product?.category_name ?? "Category"} details
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {catFields.map((f) => {
                      let opts: string[] = [];
                      try {
                        opts = f.options ? JSON.parse(f.options) : [];
                      } catch {}
                      return (
                        <Field key={f.id} label={f.label}>
                          {f.field_type === "dropdown" ? (
                            <select name={`cf_${f.field_key}`} defaultValue={existing[f.field_key] ?? ""} className={inputCls}>
                              <option value="">—</option>
                              {opts.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : f.field_type === "textarea" ? (
                            <textarea name={`cf_${f.field_key}`} rows={2} defaultValue={existing[f.field_key] ?? ""} className={inputCls} />
                          ) : (
                            <input
                              name={`cf_${f.field_key}`}
                              type={f.field_type === "number" ? "number" : "text"}
                              defaultValue={existing[f.field_key] ?? ""}
                              className={inputCls}
                            />
                          )}
                        </Field>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" name="featured" defaultChecked={!!offer?.featured} className="accent-[#8b3dff]" />
                Highlight this offer on the product page
              </label>
            </>
          )}

          {err && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

          <div className="flex gap-2">
            <Btn className="flex items-center gap-2" disabled={pending || (!productId && !offer)}>
              {pending && <Loader2 size={13} className="animate-spin" />} {offer ? "Save changes" : "Publish offer"}
            </Btn>
            <Btn variant="ghost" onClick={onClose}>
              Cancel
            </Btn>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
