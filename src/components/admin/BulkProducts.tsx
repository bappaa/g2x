"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Layers, Check, Search, Globe } from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { bulkAddProductsAction } from "@/lib/actions/admin";

type G = { slug: string; name: string };
type C = { slug: string; name: string };
type GF = { id: string; game_slug: string; field_key: string; label: string; field_type: string; options: string | null; parent_field: string | null; parent_value: string | null; sort_order: number; required: number };

export default function BulkProducts({ games, categories, allFields = [] }: { games: G[]; categories: C[]; allFields?: GF[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [category, setCategory] = useState("currency");
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [items, setItems] = useState("1,000 Coins | 0.99\n5,000 Coins | 3.99\n10,000 Coins | 6.99");
  const [fieldVals, setFieldVals] = useState<Record<string, string>>({});

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? games.filter((g) => g.name.toLowerCase().includes(s)) : games;
  }, [q, games]);

  const lineCount = items.split("\n").filter((l) => l.trim()).length;
  const total = picked.length * lineCount;

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  // Game fields for selected games - show dropdowns that admin added via Games edit
  const relevantFields = useMemo(() => {
    if (!picked.length) return [] as GF[];
    // Get fields for first selected game (or union if multiple)
    const fields = allFields.filter(f => picked.includes(f.game_slug));
    // Deduplicate by field_key, keep first
    const seen = new Set<string>();
    const out: GF[] = [];
    for (const f of fields.sort((a,b)=>a.sort_order-b.sort_order)) {
      if (!seen.has(f.field_key)) {
        seen.add(f.field_key);
        out.push(f);
      }
    }
    return out.filter(f=>!/ede/i.test(f.field_key) && f.field_key!=='gg' && !/^aa$/i.test(f.field_key) && !/^india$/i.test(f.field_key) && !/^abc$/i.test(f.field_key));
  }, [picked, allFields]);

  const getFieldOptions = (f: GF): string[] => {
    if (!f.options) return [];
    try {
      const parsed = JSON.parse(f.options);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (typeof parsed === "object" && parsed !== null) return Object.keys(parsed);
      return [];
    } catch {
      return f.options.split(",").map(x=>x.trim()).filter(Boolean);
    }
  };

  const submit = (fd: FormData) =>
    start(async () => {
      setErr(""); setMsg("");
      fd.set("games", picked.join(","));
      fd.set("items", items);
      fd.set("category", category);
      // Include game field values - these will be used as region/platform if field_key is server/region/platform
      for (const [k,v] of Object.entries(fieldVals)) {
        if (v) fd.set(`field_${k}`, v);
      }
      // If server/region selected, also set as region for product
      if (fieldVals["server"]) fd.set("region", fieldVals["server"]);
      if (fieldVals["region"]) fd.set("region", fieldVals["region"]);
      if (fieldVals["platform"]) fd.set("platform", fieldVals["platform"]);
      const r = await bulkAddProductsAction(fd).catch(() => null);
      if (!r || !r.ok) return setErr(r?.error || "Could not create the products.");
      setMsg(r.error ?? "Done.");
      router.refresh();
    });

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); submit(fd); }} className="space-y-4">
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
            <select name="deliveryTime" defaultValue="Instant" className={inputCls}>
              <option value="Instant">Instant</option>
              <option value="1 hour">1 hour</option>
              <option value="5 hour">5 hour</option>
              <option value="12 hour">12 hour</option>
              <option value="1 day">1 day</option>
              <option value="2 days">2 days</option>
              <option value="5 days">5 days</option>
              <option value="7 days">7 days</option>
              <option value="14 days">14 days</option>
            </select>
          </Field>
        </div>
        <p className="mt-2 text-[11px] muted">Region/Platform removed per request — configure servers via Games → Edit → Cascading Fields. If game has Server field, it will show below when you select a game.</p>
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

      {relevantFields.length > 0 && (
        <div className="rounded-2xl border border-brand-500/20 bg-brand-600/5 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold">
            <Globe size={14} className="text-brand-400" /> Game Server Fields (from Games → Edit → Add Field)
            <span className="ml-auto text-[11px] font-normal muted">{picked.length} game{picked.length!==1?'s':''} selected</span>
          </div>
          <p className="mb-3 text-[11px] muted">These are the dropdowns you added in Games edit. Selecting here will set Region/Platform for products created in bulk — fixes duplicate server glitch (Image-2).</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {relevantFields.map((gf) => {
              const opts = getFieldOptions(gf);
              return (
                <div key={gf.field_key}>
                  <label className="mb-1 block text-[11px] font-semibold">{gf.label}</label>
                  <select
                    value={fieldVals[gf.field_key] || ""}
                    onChange={(e) => setFieldVals(prev=>({...prev, [gf.field_key]: e.target.value}))}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 text-[13px] outline-none focus:border-brand-500"
                  >
                    <option value="">Select {gf.label}</option>
                    {opts.map(o=>(
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
