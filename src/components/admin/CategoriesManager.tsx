"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, ExternalLink, SlidersHorizontal } from "lucide-react";
import { Btn, Tag, Field, inputCls } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { saveCategoryAction, deleteCategoryAction, saveSellConfigAction } from "@/lib/actions/admin";

type C = {
  slug: string; name: string; blurb: string | null; icon: string | null;
  status: string; sort_order: number; kind: string | null; games: number; products: number;
  // Sell-wizard configuration (Phase 19).
  unit_label?: string | null;
  needs_title?: number; needs_images?: number; needs_credentials?: number;
  needs_quantity?: number; allow_volume_discount?: number;
  commission_pct?: number | null;
  sell_notice_title?: string | null; sell_notice?: string | null;
};

export default function CategoriesManager({ rows }: { rows: C[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<C | "new" | null>(null);
  const [sell, setSell] = useState<C | null>(null);
  const [busy, start] = useTransition();

  const remove = (c: C) => {
    if (!confirm(`Remove the “${c.name}” category?`)) return;
    start(async () => {
      const r = await deleteCategoryAction(c.slug);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <span className="text-[11.5px] muted">{rows.length} categories</span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> Add category
          </Btn>
        </div>
      </Toolbar>

      <Table head={["Category", "Slug", "Games", "Products", "Status", ""]}>
        {rows.map((c) => (
          <Tr key={c.slug}>
            <Td>
              <div className="font-semibold">{c.name}</div>
              {c.blurb && <div className="line-clamp-1 text-[10.5px] muted">{c.blurb}</div>}
            </Td>
            <Td className="muted">{c.slug}</Td>
            <Td className="muted">{c.games}</Td>
            <Td className="muted">{c.products}</Td>
            <Td>
              <Tag tone={c.status === "active" ? "green" : "slate"}>
                {c.status === "active" ? "Live" : "Hidden"}
              </Tag>
            </Td>
            <Td>
              <div className="flex justify-end gap-1.5">
                <Link href={`/c/${c.slug}`} target="_blank">
                  <IconAction title="View on site"><ExternalLink size={12} /></IconAction>
                </Link>
                <IconAction title="Sell flow" onClick={() => setSell(c)}>
                  <SlidersHorizontal size={12} />
                </IconAction>
                <IconAction title="Edit" onClick={() => setEdit(c)}><Pencil size={12} /></IconAction>
                <IconAction title="Remove" danger disabled={busy} onClick={() => remove(c)}>
                  <Trash2 size={12} />
                </IconAction>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      <AnimatePresence>
        {edit && <CatForm cat={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
        {sell && <SellConfigForm cat={sell} onClose={() => setSell(null)} />}
      </AnimatePresence>
    </div>
  );
}

function CatForm({ cat, onClose }: { cat: C | null; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveCategoryAction(fd);
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
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{cat ? "Edit category" : "Add a category"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>

        <input type="hidden" name="original" value={cat?.slug ?? ""} />
        <Field label="Name">
          <input name="name" required defaultValue={cat?.name} className={inputCls} placeholder="Top Up" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Slug">
            <input name="slug" defaultValue={cat?.slug} className={inputCls} placeholder="top-up" />
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={cat?.sort_order ?? 0} className={inputCls} />
          </Field>
        </div>
        <Field label="Short description">
          <textarea name="blurb" rows={2} defaultValue={cat?.blurb ?? ""} className={inputCls} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={cat?.status ?? "active"} className={inputCls}>
            <option value="active">Live on site</option>
            <option value="hidden">Hidden</option>
          </select>
        </Field>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2 pt-1">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}

/**
 * Per-category sell-wizard configuration.
 *
 * Everything here changes what a seller is asked for when they create an offer
 * in this category — no deployment needed. Field-level requirements (extra
 * dropdowns, text boxes) live in Admin -> Field Templates.
 */
function SellConfigForm({ cat, onClose }: { cat: C; onClose: () => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");

  const Check = ({ name, label, hint, def }: { name: string; label: string; hint: string; def?: number }) => (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg soft px-3 py-2.5">
      <input type="checkbox" name={name} defaultChecked={!!def} className="mt-0.5 accent-[var(--brand,#8b3dff)]" />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[11px] muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4"
    >
      <motion.form
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        action={(fd) =>
          start(async () => {
            const r = await saveSellConfigAction(fd);
            if (!r.ok) { setErr(r.error ?? "Could not save."); return; }
            onClose();
            router.refresh();
          })
        }
        className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-2xl panel p-4 sm:p-5"
      >
        <input type="hidden" name="slug" value={cat.slug} />

        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-[15px] font-black">Sell flow — {cat.name}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>
        <p className="mb-4 text-[11.5px] muted">
          Controls what sellers are asked for when listing in this category.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Unit label">
            <input
              name="unitLabel"
              defaultValue={cat.unit_label ?? "unit"}
              placeholder="K, M, unit, account…"
              className={inputCls}
            />
          </Field>
          <Field label="Commission %">
            <input
              name="commissionPct"
              type="number"
              step="0.1"
              min={0}
              max={90}
              defaultValue={cat.commission_pct ?? ""}
              placeholder="Default"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-3 space-y-1.5">
          <Check name="needsTitle" label="Require an offer title" hint="Ask the seller to write their own headline." def={cat.needs_title} />
          <Check name="needsImages" label="Allow offer photos" hint="Show the image uploader." def={cat.needs_images} />
          <Check name="needsCredentials" label="Collect account credentials" hint="Adds the encrypted login/2FA vault and the automatic-vs-manual delivery choice." def={cat.needs_credentials} />
          <Check name="needsQuantity" label="Ask for quantity" hint="Turn off for one-off services." def={cat.needs_quantity} />
          <Check name="allowVolumeDiscount" label="Allow volume discounts" hint="Bulk pricing tiers." def={cat.allow_volume_discount} />
        </div>

        <div className="mt-3 grid gap-3">
          <Field label="Notice title (optional)">
            <input
              name="noticeTitle"
              defaultValue={cat.sell_notice_title ?? ""}
              placeholder="e.g. 5 Day money hold system"
              className={inputCls}
            />
          </Field>
          <Field label="Notice body (optional)">
            <textarea
              name="notice"
              rows={4}
              defaultValue={cat.sell_notice ?? ""}
              placeholder="Shown to the seller before they choose a game."
              className={inputCls}
            />
          </Field>
        </div>

        {err && <div className="mt-3 text-[12px] text-rose-400">{err}</div>}

        <div className="mt-4 flex items-center gap-2">
          <Btn type="submit" disabled={busy} className="flex items-center gap-1.5">
            {busy && <Loader2 size={13} className="animate-spin" />} Save
          </Btn>
          <button type="button" onClick={onClose} className="rounded-lg soft px-4 py-2 text-[12.5px] font-semibold">
            Cancel
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
