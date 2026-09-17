"use client";
import { useMemo, useState } from "react";
import { Globe } from "lucide-react";
import ProductCard, { CardProduct } from "./ProductCard";
import type { DbOffer } from "@/lib/queries";

type GameField = {
  id: string;
  game_slug: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string | null;
  parent_field: string | null;
  parent_value: string | null;
  sort_order: number;
  required: number;
};

type OfferWithProduct = DbOffer & { product_id: string; product_slug: string };

export default function GameCategoryProducts({
  products,
  gameFields = [],
  offers = [],
}: {
  products: (CardProduct & { id: string; slug: string })[];
  gameFields?: GameField[];
  offers?: OfferWithProduct[];
}) {
  const parseCF = (o: DbOffer): Record<string, string> => {
    try {
      const v = o.custom_fields ? JSON.parse(o.custom_fields) : {};
      return typeof v === "object" && v !== null ? (v as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  const [filters, setFilters] = useState<Record<string, string>>({});

  const setFilter = (key: string, val: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!val) delete next[key];
      else next[key] = val;
      const clearChildren = (parentKey: string) => {
        for (const gf of gameFields) {
          if (gf.parent_field === parentKey) {
            delete next[gf.field_key];
            clearChildren(gf.field_key);
          }
        }
      };
      clearChildren(key);
      return next;
    });
  };

  const isVisible = (gf: GameField, f: Record<string, string>) => {
    if (!gf.parent_field) return true;
    const pv = f[gf.parent_field] || "";
    if (!pv) return false;
    if (gf.parent_value && pv !== gf.parent_value) return false;
    return true;
  };

  const offerCF = useMemo(() => offers.map((o) => ({ product_id: o.product_id, cf: parseCF(o), region: o.region })), [offers]);

  // Filter out test fields like 'ede'
  const cleanGameFields = gameFields.filter(f => !/ede/i.test(f.field_key) && !/ede/i.test(f.label) && f.field_key!=='gg' && f.label!=='gg' && f.field_key.length>=2);

  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    const fieldsForOptions = cleanGameFields;
    for (const gf of fieldsForOptions) {
      const vals = new Set<string>();
      for (const { cf, region } of offerCF) {
        const v = cf[gf.field_key] || (gf.field_key === "region" ? region || "" : "");
        if (v) vals.add(String(v));
      }
      if (vals.size === 0 && gf.options) {
        try {
          const parsed = JSON.parse(gf.options) as unknown;
          if (Array.isArray(parsed)) (parsed as unknown[]).forEach((x) => vals.add(String(x)));
          else if (typeof parsed === "object" && parsed !== null) {
            Object.keys(parsed as Record<string, unknown>).forEach((k) => vals.add(k));
            Object.values(parsed as Record<string, unknown>).forEach((v) => {
              if (Array.isArray(v)) (v as unknown[]).forEach((vv) => vals.add(String(vv)));
              else if (v) vals.add(String(v as string));
            });
          }
        } catch {
          gf.options.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => vals.add(x));
        }
      }
      map[gf.field_key] = Array.from(vals).sort();
    }
    return map;
  }, [cleanGameFields, offerCF]);

  const filteredProducts = useMemo(() => {
    if (cleanGameFields.length === 0 || Object.keys(filters).length === 0) return products;
    // Keep products that have at least one offer matching filters
    return products.filter((p) => {
      const relevantOffers = offerCF.filter((o) => o.product_id === p.id);
      if (relevantOffers.length === 0) return false;
      return relevantOffers.some(({ cf, region }) => {
        for (const [k, v] of Object.entries(filters)) {
          const ov = cf[k] || (k === "region" ? region || "" : "");
          if (ov !== v) return false;
        }
        return true;
      });
    });
  }, [products, filters, cleanGameFields, offerCF]);

  const hasFilters = cleanGameFields.length > 0 && Object.values(filterOptions).some((arr) => arr.length > 0);

  return (
    <div className="rounded-2xl panel p-3.5 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <h2 className="text-[14px] font-bold">Currency Packages</h2>
        <span className="text-[11.5px] muted">
          {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
          {filteredProducts.length !== products.length ? ` / ${products.length}` : ""}
        </span>
      </div>

      {hasFilters && (
        <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--panel)]/50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide muted">
            <Globe size={12} /> Select Server
            {Object.keys(filters).length > 0 && (
              <button type="button" onClick={() => setFilters({})} className="ml-auto text-[11px] normal-case text-brand-400 hover:underline">
                Clear
              </button>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {cleanGameFields
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((gf) => {
                if (!isVisible(gf, filters)) return null;
                const opts = filterOptions[gf.field_key] || [];
                if (opts.length === 0) return null;
                return (
                  <div key={gf.id}>
                    <label className="mb-1 block text-[11px] font-semibold">{gf.label}</label>
                    <div className="relative">
                      <select
                        value={filters[gf.field_key] || ""}
                        onChange={(e) => setFilter(gf.field_key, e.target.value)}
                        className="w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 pr-8 text-[13px] font-medium outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      >
                        <option value="">All {gf.label}</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] muted">▼</span>
                    </div>
                  </div>
                );
              })}
          </div>
          {Object.keys(filters).length === 0 && (
            <p className="mt-2 text-[11px] muted">Choose a server to see products available for that server.</p>
          )}
        </div>
      )}

      {filteredProducts.length ? (
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {filteredProducts.map((p, i) => (
            <ProductCard key={p.id} p={p} i={i} />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center">
          <div className="text-[13px] font-semibold">No products for selected server</div>
          <div className="mt-1 text-[11px] muted">Try another server or clear filters.</div>
        </div>
      )}
    </div>
  );
}
