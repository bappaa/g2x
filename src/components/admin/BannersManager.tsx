"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Eye, EyeOff, ImageIcon } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Toolbar, IconAction } from "@/components/admin/ui";
import ImagePicker from "@/components/admin/ImagePicker";
import { saveBannerAction, deleteBannerAction, toggleBannerAction } from "@/lib/actions/admin";

type B = {
  id: string; title: string; subtitle: string; image: string;
  cta_label: string; cta_href: string; placement: string; bg_color: string;
  sort_order: number; active: number;
};

const PLACEMENTS = [
  ["hero", "Hero slider (homepage top)"],
  ["strip", "Promo strip (below hero)"],
  ["sidebar", "Sidebar"],
  ["category", "Category page"],
];

export default function BannersManager({ rows }: { rows: B[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<B | "new" | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <Toolbar>
        <span className="text-[11.5px] muted">{rows.length} banners</span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> Add banner
          </Btn>
        </div>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No banners yet" sub="Create a hero slide or a promo strip for the homepage." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((b) => (
            <motion.div key={b.id} layout className="overflow-hidden rounded-2xl panel">
              <div
                className="relative flex h-[120px] items-center gap-3 p-4"
                style={b.bg_color ? { background: b.bg_color } : undefined}
              >
                {b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center soft muted">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="relative z-10">
                  <div className="text-[14px] font-black drop-shadow">{b.title || "Untitled"}</div>
                  {b.subtitle && <div className="text-[11px] drop-shadow">{b.subtitle}</div>}
                  {b.cta_label && (
                    <span className="mt-1.5 inline-block rounded bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {b.cta_label}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5">
                <Tag tone="slate">{b.placement}</Tag>
                <Tag tone={b.active === 1 ? "green" : "slate"}>{b.active === 1 ? "Live" : "Off"}</Tag>
                <span className="text-[10px] muted">#{b.sort_order}</span>
                <div className="ml-auto flex gap-1.5">
                  <IconAction
                    title={b.active === 1 ? "Hide" : "Publish"}
                    disabled={busy}
                    onClick={() => start(async () => { await toggleBannerAction(b.id, b.active !== 1); router.refresh(); })}
                  >
                    {b.active === 1 ? <EyeOff size={12} /> : <Eye size={12} />}
                  </IconAction>
                  <IconAction title="Edit" onClick={() => setEdit(b)}><Pencil size={12} /></IconAction>
                  <IconAction
                    title="Delete" danger disabled={busy}
                    onClick={() => {
                      if (!confirm("Delete this banner?")) return;
                      start(async () => { await deleteBannerAction(b.id); router.refresh(); });
                    }}
                  >
                    <Trash2 size={12} />
                  </IconAction>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {edit && <Form b={edit === "new" ? null : edit} count={rows.length} onClose={() => setEdit(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Form({ b, count, onClose }: { b: B | null; count: number; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveBannerAction(fd);
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
        className="max-h-[90vh] w-full max-w-[520px] space-y-3 overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{b ? "Edit banner" : "Add banner"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={b?.id ?? ""} />

        <ImagePicker label="Banner image" urlName="image" fileName="imageFile" defaultUrl={b?.image ?? ""} />

        <Field label="Title">
          <input name="title" defaultValue={b?.title} className={inputCls} placeholder="Summer Sale — up to 40% off" />
        </Field>
        <Field label="Subtitle">
          <input name="subtitle" defaultValue={b?.subtitle} className={inputCls} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button label">
            <input name="ctaLabel" defaultValue={b?.cta_label} className={inputCls} placeholder="Shop now" />
          </Field>
          <Field label="Button link">
            <input name="ctaHref" defaultValue={b?.cta_href} className={inputCls} placeholder="/c/top-up" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Placement">
            <select name="placement" defaultValue={b?.placement ?? "hero"} className={inputCls}>
              {PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Background">
            <input name="bgColor" type="color" defaultValue={b?.bg_color || "#8b3dff"} className={`${inputCls} h-[38px] p-1`} />
          </Field>
          <Field label="Order">
            <input name="sortOrder" type="number" defaultValue={b?.sort_order ?? count} className={inputCls} />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" name="active" defaultChecked={b ? b.active === 1 : true} className="accent-brand-600" />
          Show this banner live
        </label>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save banner
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
