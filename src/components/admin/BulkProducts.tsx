"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Layers, Check, Search } from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { bulkAddProductsAction } from "@/lib/actions/admin";

type G = { slug: string; name: string };
type C = { slug: string; name: string };

/**
 * Bulk product creator.
 *
 * Currency and Top Up repeat the same denominations across dozens of games, so
 * adding them one at a time through the product form is hours of work. Pick a
 * category, tick the games, paste the denominations once.
 *
 * Products inherit the game's logo, so the category page and the product tiles
 * both have artwork straight away instead of blank squares.
 */
export default function BulkProducts({ games, categories }: { games: G[]; categories: C[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [category, setCategory] = useState("currency");
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [items, setItems] = useState("1,000 Coins | 0.99\n5,000 Coins | 3.99\n10,000 Coins | 6.99");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? games.filter((g) => g.name.toLowerCase().includes(s)) : games;
  }, [q, games]);

  const lineCount = items.split("\n").filter((l) => l.trim()).length;
  const total = picked.length * lineCount;

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  const submit = (fd: FormData) =>
    start(async () => {
      setErr(""); setMsg("");
      fd.set("games", picked.join(","));
      fd.set("items", items);
      fd.set("category", category);
      const r = await bulkAddProductsAction(fd).catch(() => null);
      if (!r || !r.ok) return setErr(r?.error || "Could not create the products.");
      setMsg(r.error ?? "Done.");
      router.refresh();
    });

  return (
    <form action={submit} className="space-y-4">
      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Delivery time">
            <input name="deliveryTime" defaultValue="Instant" className={inputCls} />
          </Field>
          <Field label="Region">
            <input name="region" defaultValue="Global" className={inputCls} />
          </Field>
          <Field label="Platform">
            <input name="platform" defaultValue="All" className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[13.5px] font-bold">Games</h2>
          <span className="text-[11.5px] muted">{picked.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setPicked(shown.map((g) => g.slug))}
              className="rounded-lg soft px-2.5 py-1 text-[11.5px] font-semibold"
            >
              Select all{q ? " shown" : ""}
            </button>
            <button
              type="button"
              onClick={() => setPicked([])}
              className="rounded-lg soft px-2.5 py-1 text-[11.5px] font-semibold"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mb-3 flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 soft focus-within:border-brand-500">
          <Search size={14} className="muted shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${games.length} games`}
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[var(--muted)]"
          />
        </div>

        <div className="max-h-[280px] overflow-y-auto rounded-lg border border-[var(--line)] p-1">
          {shown.map((g) => (
            <label
              key={g.slug}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-brand-600/10"
            >
              <input
                type="checkbox"
                checked={picked.includes(g.slug)}
                onChange={() => toggle(g.slug)}
                className="accent-[var(--brand,#8b3dff)]"
              />
              {g.name}
            </label>
          ))}
          {!shown.length && (
            <div className="py-6 text-center text-[12px] muted">No games match that search.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl panel p-4 sm:p-5">
        <h2 className="mb-1 text-[13.5px] font-bold">Products — one per line</h2>
        <p className="mb-2 text-[11.5px] muted">
          Format: <code>Name | price</code>. The price is the starting RRP; sellers set their own.
        </p>
        <textarea
          rows={8}
          value={items}
          onChange={(e) => setItems(e.target.value)}
          className={`${inputCls} h-auto py-2 font-mono text-[12px]`}
        />
        <div className="mt-2 text-[11.5px] muted">
          {lineCount} product{lineCount === 1 ? "" : "s"} × {picked.length} game
          {picked.length === 1 ? "" : "s"} ={" "}
          <b className={total > 2000 ? "text-rose-400" : "text-brand-400"}>{total}</b> to create
        </div>
      </div>

      {err && <div className="text-[12.5px] text-rose-400">{err}</div>}
      {msg && (
        <div className="flex items-center gap-2 text-[12.5px] text-emerald-400">
          <Check size={14} /> {msg}
        </div>
      )}

      <Btn type="submit" disabled={busy || !total} className="flex items-center gap-2">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
        Create {total || ""} product{total === 1 ? "" : "s"}
      </Btn>
    </form>
  );
}
