"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, X, Loader2, Eye, EyeOff, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { Btn, Tag, Field, inputCls } from "@/components/ui";
import ImagePicker from "@/components/admin/ImagePicker";
import { saveCmsBlockAction } from "@/lib/actions/admin";

type B = { key: string; name: string };
type Row = {
  key: string; title: string; subtitle: string; body: string; image: string;
  cta_label: string; cta_href: string; data: string | null;
  active: number; updated_at: string;
};

/** Blocks that carry a repeatable list, and the columns each row has. */
const LIST_SCHEMA: Record<string, { fields: [string, string][]; label: string; hint: string }> = {
  hero: {
    label: "Hero rows",
    hint:
      "One row per perk (icon + label). Add a row with only 'badge' for the pill above the " +
      "headline, or a row with deal/dealPrice/dealWas for the artwork price tag, or " +
      "cta2/cta2href for the secondary button.",
    fields: [
      ["icon", "Icon name"], ["label", "Perk text"],
      ["badge", "Top badge"],
      ["deal", "Deal name"], ["dealPrice", "Deal price"], ["dealWas", "Deal was"],
      ["cta2", "2nd button"], ["cta2href", "2nd button link"],
    ],
  },
  announcement_bar: {
    label: "Scrolling messages",
    hint: "Each row is one message in the marquee above the navbar. Remove all rows to hide the bar.",
    fields: [["text", "Message"]],
  },
  trust: {
    label: "Trust points",
    hint: "Shown before the live marketplace counters.",
    fields: [["icon", "Icon name"], ["value", "Headline"], ["label", "Sub-text"]],
  },
  faq: {
    label: "Questions",
    hint: "Shown on the FAQ section.",
    fields: [["q", "Question"], ["a", "Answer"]],
  },
};

export default function CmsManager({ blocks, rows }: { blocks: B[]; rows: Row[] }) {
  const [edit, setEdit] = useState<{ b: B; r?: Row } | null>(null);
  const map = new Map(rows.map((r) => [r.key, r]));

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b, i) => {
          const r = map.get(b.key);
          const on = r ? r.active === 1 : true;
          return (
            <motion.button
              key={b.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setEdit({ b, r })}
              className="rounded-2xl panel p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-500/40"
            >
              <div className="flex items-center gap-2">
                <LayoutTemplate size={14} className="text-brand-400" />
                <span className="flex-1 text-[13px] font-bold">{b.name}</span>
                {on ? <Eye size={12} className="text-emerald-400" /> : <EyeOff size={12} className="muted" />}
              </div>
              <div className="mt-1.5 line-clamp-1 text-[11.5px] muted">
                {r?.title || <span className="italic">Using the built-in default</span>}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Tag tone={r ? "brand" : "slate"}>{r ? "Customised" : "Default"}</Tag>
                <span className="ml-auto flex items-center gap-1 text-[10.5px] text-brand-400">
                  <Pencil size={10} /> Edit
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {edit && <Form b={edit.b} r={edit.r} onClose={() => setEdit(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Form({ b, r, onClose }: { b: B; r?: Row; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const res = await saveCmsBlockAction(fd);
      if (!res.ok) return setErr(res.error || "Could not save.");
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
          <h2 className="text-[15px] font-black">{b.name}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="key" value={b.key} />

        <Field label="Heading">
          <input name="title" defaultValue={r?.title ?? ""} className={inputCls} />
        </Field>
        <Field label="Sub-heading">
          <input name="subtitle" defaultValue={r?.subtitle ?? ""} className={inputCls} />
        </Field>
        <Field label="Body copy">
          <textarea name="body" rows={3} defaultValue={r?.body ?? ""} className={inputCls} />
        </Field>
        <ImagePicker
          label="Image"
          urlName="image"
          fileName="imageFile"
          defaultUrl={r?.image ?? ""}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button label">
            <input name="ctaLabel" defaultValue={r?.cta_label ?? ""} className={inputCls} placeholder="Shop now" />
          </Field>
          <Field label="Button link">
            <input name="ctaHref" defaultValue={r?.cta_href ?? ""} className={inputCls} placeholder="/c/top-up" />
          </Field>
        </div>
        {LIST_SCHEMA[b.key] && <ListEditor spec={LIST_SCHEMA[b.key]} raw={r?.data ?? null} />}

        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" name="active" defaultChecked={r ? r.active === 1 : true} className="accent-brand-600" />
          Show this section on the homepage
        </label>
        <p className="text-[10.5px] muted">
          Turning a section off hides it from the homepage completely — no placeholder is shown.
        </p>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save section
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}


/**
 * Repeatable-row editor. Keeps the rows in React state and serialises them
 * into a single hidden `data` field as JSON on submit, so the server action
 * stays a plain form post.
 */
function ListEditor({
  spec, raw,
}: {
  spec: { fields: [string, string][]; label: string; hint: string };
  raw: string | null;
}) {
  const initial = (() => {
    if (!raw) return [] as Record<string, string>[];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as Record<string, string>[]) : [];
    } catch {
      return [];
    }
  })();

  const [rows, setRows] = useState<Record<string, string>[]>(initial);

  const set = (i: number, k: string, v: string) =>
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  return (
    <div className="space-y-2 rounded-xl border border-[var(--line)] p-3">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold">{spec.label}</span>
        <span className="text-[10px] muted">{rows.length}</span>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, {}])}
          className="ml-auto flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-[10.5px] font-semibold text-white hover:bg-brand-500"
        >
          <Plus size={10} /> Add row
        </button>
      </div>
      <p className="text-[10px] muted">{spec.hint}</p>

      <input type="hidden" name="data" value={rows.length ? JSON.stringify(rows) : ""} />

      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <div className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${spec.fields.length},1fr)` }}>
            {spec.fields.map(([k, ph]) => (
              <input
                key={k}
                value={row[k] ?? ""}
                onChange={(e) => set(i, k, e.target.value)}
                placeholder={ph}
                className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500"
              />
            ))}
          </div>
          <button
            type="button"
            title="Remove row"
            onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
            className="mt-0.5 rounded-lg p-1.5 soft hover:text-rose-400"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="py-2 text-center text-[11px] muted">No rows — this list will be hidden.</p>
      )}
    </div>
  );
}
