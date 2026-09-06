"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pencil, Trash2, X, Loader2, Layers, Check } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { money } from "@/lib/fmt";
import ImagePicker from "@/components/admin/ImagePicker";
import { saveProductAction, deleteProductAction, bulkProductAction } from "@/lib/actions/admin";

export type Opt = { id: string; value: string; label: string };

type P = {
  id: string; slug: string; name: string; image: string; game_slug: string; category_slug: string;
  game_name: string; category_name: string; base_price: number; old_price: number | null;
  discount_pct: number | null; region: string; platform: string; delivery_method: string;
  delivery_time: string; login_method: string | null; delivery_instructions: string | null;
  status: string; popular: number; featured: number; pinned: number; sort_order: number;
  offer_count: number; min_price: number | null;
};
type G = { slug: string; name: string };
type C = { slug: string; name: string };

export default function ProductsManager({
  rows, games, categories, filters, options,
}: {
  rows: P[]; games: G[]; categories: C[];
  filters: { game: string; category: string; q: string };
  options: Record<string, Opt[]>;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(filters.q);
  const [sel, setSel] = useState<string[]>([]);
  const [edit, setEdit] = useState<P | "new" | null>(null);
  const [busy, start] = useTransition();

  const nav = (patch: Record<string, string>) => {
    const sp = new URLSearchParams({ ...filters, ...patch });
    Array.from(sp.keys()).forEach((k) => { if (!sp.get(k)) sp.delete(k); });
    router.push(`/admin/products?${sp.toString()}`);
  };

  const bulk = (op: string) => {
    const value = op === "price_pct" ? Number(prompt("Adjust price by what percentage? e.g. 10 or -5")) : undefined;
    if (op === "price_pct" && !Number.isFinite(value!)) return;
    if (op === "delete" && !confirm(`Delete ${sel.length} products?`)) return;
    start(async () => {
      const r = await bulkProductAction(sel, op, value);
      if (!r.ok) alert(r.error);
      setSel([]);
      router.refresh();
    });
  };

  const remove = (p: P) => {
    if (!confirm(`Delete “${p.name}”?`)) return;
    start(async () => {
      const r = await deleteProductAction(p.id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <form className="relative min-w-[180px] flex-1" onSubmit={(e) => { e.preventDefault(); nav({ q: term }); }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input className={`${inputCls} pl-8`} placeholder="Search products…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
        <select className={`${inputCls} w-auto`} value={filters.game} onChange={(e) => nav({ game: e.target.value })}>
          <option value="">All games</option>
          {games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={filters.category} onChange={(e) => nav({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
          <Plus size={13} /> Add product
        </Btn>
      </Toolbar>

      <AnimatePresence>
        {sel.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-600/10 p-2.5"
          >
            <Layers size={13} className="text-brand-400" />
            <span className="text-[12px] font-semibold">{sel.length} selected</span>
            {[
              ["activate", "Activate"], ["deactivate", "Deactivate"],
              ["popular", "Mark popular"], ["unpopular", "Unmark popular"],
              ["price_pct", "Adjust price %"], ["delete", "Delete"],
            ].map(([op, l]) => (
              <button
                key={op}
                disabled={busy}
                onClick={() => bulk(op)}
                className={`rounded-lg px-2.5 py-1 text-[11.5px] soft hover:text-brand-400 ${op === "delete" ? "hover:text-rose-400" : ""}`}
              >
                {l}
              </button>
            ))}
            <button onClick={() => setSel([])} className="ml-auto text-[11.5px] muted hover:text-rose-400">Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {rows.length === 0 ? (
        <Empty title="No products" sub="Adjust the filters, or add a new product." />
      ) : (
        <Table head={["", "Product", "Game", "Category", "Base price", "Offers", "From", "Status", ""]}>
          {rows.map((p) => (
            <Tr key={p.id}>
              <Td>
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={sel.includes(p.id)}
                  onChange={(e) => setSel((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
              </Td>
              <Td>
                <div className="font-semibold">{p.name}</div>
                <div className="flex gap-1 pt-0.5">
                  {p.popular === 1 && <span className="rounded bg-amber-500/15 px-1 text-[9px] text-amber-400">Popular</span>}
                  {p.featured === 1 && <span className="rounded bg-brand-600/15 px-1 text-[9px] text-brand-400">Featured</span>}
                </div>
              </Td>
              <Td className="muted">{p.game_name}</Td>
              <Td className="muted">{p.category_name}</Td>
              <Td className="font-semibold">{money(p.base_price)}</Td>
              <Td className="muted">{p.offer_count}</Td>
              <Td className="muted">{p.min_price ? money(p.min_price) : "—"}</Td>
              <Td>
                <Tag tone={p.status === "active" ? "green" : "slate"}>{p.status === "active" ? "Live" : "Hidden"}</Tag>
              </Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <IconAction title="Edit" onClick={() => setEdit(p)}><Pencil size={12} /></IconAction>
                  <IconAction title="Delete" danger disabled={busy} onClick={() => remove(p)}><Trash2 size={12} /></IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <AnimatePresence>
        {edit && (
          <ProductForm
            p={edit === "new" ? null : edit}
            games={games}
            categories={categories}
            options={options}
            onClose={() => setEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductForm({
  p, games, categories, options, onClose,
}: {
  p: P | null; games: G[]; categories: C[];
  options: Record<string, Opt[]>; onClose: () => void;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveProductAction(fd);
      if (!r.ok) return setErr(r.error || "Could not save.");
      onClose();
      router.refresh();
    });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.form
        action={submit}
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[600px] space-y-3 overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{p ? "Edit product" : "Add a product"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={p?.id ?? ""} />

        <Field label="Product / denomination name">
          <input name="name" required defaultValue={p?.name} className={inputCls} placeholder="1000 + 100 UC" />
        </Field>

        <ImagePicker
          label="Product image"
          urlName="image"
          fileName="imageFile"
          defaultUrl={p?.image ?? ""}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Game">
            <select name="game" defaultValue={p?.game_slug} className={inputCls} required>
              <option value="">Choose…</option>
              {games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={p?.category_slug} className={inputCls} required>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Base price (USD)">
            <input name="basePrice" type="number" step="0.01" required defaultValue={p?.base_price} className={inputCls} />
          </Field>
          <Field label="Compare-at price">
            <input name="oldPrice" type="number" step="0.01" defaultValue={p?.old_price ?? ""} className={inputCls} />
          </Field>
          <Field label="Discount %">
            <input name="discount" type="number" defaultValue={p?.discount_pct ?? ""} className={inputCls} />
          </Field>
        </div>

        <Field
          label="Regions / game servers"
          hint="Tick every server this product works on. Buyers pick one on the product page. Manage the list in Catalog → Dropdown Options."
        >
          <RegionPicker opts={options.region} value={p?.region} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Platform">
            <OptionSelect name="platform" opts={options.platform} value={p?.platform} fallback="All" />
          </Field>
          <Field label="Typical delivery time">
            <input name="deliveryTime" defaultValue={p?.delivery_time ?? "5–30 min"} className={inputCls} />
          </Field>
        </div>

        <Field label="Delivery method" hint="Buyers choose one of these on the product page">
          <MultiPicker
            name="deliveryMethod"
            opts={options.delivery_method}
            value={p?.delivery_method}
            fallback="Instant code"
          />
        </Field>

        <Field label="Login method" hint="What the buyer must provide for the seller to deliver">
          <OptionSelect
            name="loginMethod"
            opts={options.login_method}
            value={p?.login_method}
            fallback=""
            allowEmpty
          />
        </Field>

        <Field label="Buyer instructions">
          <textarea name="instructions" rows={2} defaultValue={p?.delivery_instructions ?? ""} className={inputCls} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select name="status" defaultValue={p?.status ?? "active"} className={inputCls}>
              <option value="active">Live</option>
              <option value="inactive">Hidden</option>
            </select>
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={p?.sort_order ?? 0} className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3 rounded-xl soft p-3 text-[12px]">
          {[
            { n: "popular", l: "Popular", d: p?.popular },
            { n: "featured", l: "Featured", d: p?.featured },
            { n: "pinned", l: "Pinned", d: p?.pinned },
          ].map((c) => (
            <label key={c.n} className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" name={c.n} defaultChecked={c.d === 1} className="accent-brand-600" /> {c.l}
            </label>
          ))}
        </div>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save product
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}


/**
 * Select backed by an admin-managed option list. If the saved value is not in
 * the list any more (e.g. the admin renamed it) it is still shown, so editing a
 * product never silently loses data.
 */
function OptionSelect({
  name, opts, value, fallback, allowEmpty,
}: {
  name: string; opts?: Opt[]; value?: string | null;
  fallback: string; allowEmpty?: boolean;
}) {
  const list = opts ?? [];
  const current = value ?? fallback;
  const missing = current && !list.some((o) => o.label === current);

  return (
    <select name={name} defaultValue={current} className={inputCls}>
      {allowEmpty && <option value="">— none —</option>}
      {missing && <option value={current}>{current}</option>}
      {list.map((o) => (
        <option key={o.id} value={o.label}>
          {o.label}
        </option>
      ))}
    </select>
  );
}


/**
 * Multi-select chip picker used for regions and delivery methods.
 *
 * Values are stored as a comma-separated string in the existing column, so no
 * migration is needed and a single-value product keeps working unchanged.
 * The first ticked value is the default the product page pre-selects.
 */
function MultiPicker({
  name, opts, value, fallback,
}: {
  name: string; opts?: Opt[]; value?: string | null; fallback: string;
}) {
  const list = opts ?? [];
  const initial = (value ?? fallback)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const [picked, setPicked] = useState<string[]>(initial.length ? initial : [fallback].filter(Boolean));

  // labels present on the product but no longer in the option list
  const extra = initial.filter((v) => !list.some((o) => o.label === v));
  const all = Array.from(new Set([...list.map((o) => o.label), ...extra]));

  const toggle = (label: string) =>
    setPicked((cur) =>
      cur.includes(label) ? cur.filter((v) => v !== label) : [...cur, label]
    );

  return (
    <div>
      <input type="hidden" name={name} value={picked.join(", ")} />
      <div className="flex flex-wrap gap-1.5">
        {all.map((label) => {
          const on = picked.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                on
                  ? "border-brand-500 bg-brand-600/15 text-brand-300"
                  : "border-[var(--line)] soft muted hover:border-brand-500/50"
              }`}
            >
              {on && <Check size={11} />}
              {label}
            </button>
          );
        })}
        {!all.length && (
          <span className="text-[11.5px] muted">
            No options yet — add some in Catalog → Dropdown Options.
          </span>
        )}
      </div>
      {picked.length > 1 && (
        <p className="mt-1.5 text-[10.5px] muted">
          <strong>{picked[0]}</strong> is the default shown to buyers.
        </p>
      )}
    </div>
  );
}

function RegionPicker({ opts, value }: { opts?: Opt[]; value?: string | null }) {
  return <MultiPicker name="region" opts={opts} value={value} fallback="Global" />;
}
