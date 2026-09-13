"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Eye, EyeOff, Asterisk } from "lucide-react";
import { Btn, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { saveTemplateFieldAction, deleteTemplateFieldAction } from "@/lib/actions/admin";

type F = {
  id: string; category_slug: string; label: string; field_key: string; field_type: string;
  options: string | null; required: number; show_frontend: number; sort_order: number;
};
type C = { slug: string; name: string };

const TYPES = [
  ["text", "Text"], ["number", "Number"], ["dropdown", "Dropdown"], ["textarea", "Textarea"],
  ["switch", "Switch"], ["radio", "Radio"], ["checkbox", "Checkbox"], ["date", "Date"],
  ["image", "Image upload"], ["file", "File upload"],
];

export default function TemplatesManager({
  categories, category, fields,
}: {
  categories: C[]; category: string; fields: F[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<F | "new" | null>(null);
  const [busy, start] = useTransition();

  const remove = (f: F) => {
    if (!confirm(`Delete the “${f.label}” field?`)) return;
    start(async () => {
      await deleteTemplateFieldAction(f.id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <select
          className={`${inputCls} w-auto`}
          value={category}
          onChange={(e) => router.push(`/admin/templates?category=${e.target.value}`)}
        >
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <span className="text-[11.5px] muted">{fields.length} fields</span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> Add field
          </Btn>
        </div>
      </Toolbar>

      {fields.length === 0 ? (
        <Empty title="No fields yet" sub="Add the first field sellers must complete for this category." />
      ) : (
        <Table head={["Label", "Key", "Type", "Options", "Required", "Buyer-visible", "Order", ""]}>
          {fields.map((f) => (
            <Tr key={f.id}>
              <Td className="font-semibold">{f.label}</Td>
              <Td className="font-mono text-[11px] muted">{f.field_key}</Td>
              <Td className="capitalize muted">{f.field_type}</Td>
              <Td className="max-w-[180px] truncate text-[11px] muted">
                {f.options ? (JSON.parse(f.options) as string[]).join(", ") : "—"}
              </Td>
              <Td>
                {f.required === 1
                  ? <Asterisk size={12} className="text-rose-400" />
                  : <span className="muted">—</span>}
              </Td>
              <Td>
                {f.show_frontend === 1
                  ? <Eye size={12} className="text-emerald-400" />
                  : <EyeOff size={12} className="muted" />}
              </Td>
              <Td className="muted">{f.sort_order}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <IconAction title="Edit" onClick={() => setEdit(f)}><Pencil size={12} /></IconAction>
                  <IconAction title="Delete" danger disabled={busy} onClick={() => remove(f)}><Trash2 size={12} /></IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <AnimatePresence>
        {edit && (
          <FieldForm
            f={edit === "new" ? null : edit}
            category={category}
            onClose={() => setEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldForm({ f, category, onClose }: { f: F | null; category: string; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState(f?.field_type ?? "text");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveTemplateFieldAction(fd);
      if (!r.ok) return setErr(r.error || "Could not save.");
      onClose();
      router.refresh();
    });

  const needsOptions = ["dropdown", "radio", "checkbox"].includes(type);

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
        className="w-full max-w-[480px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{f ? "Edit field" : "Add a field"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={f?.id ?? ""} />
        <input type="hidden" name="category" value={category} />

        <Field label="Field label">
          <input name="label" required defaultValue={f?.label} className={inputCls} placeholder="Server / Region" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Field key" hint="Leave blank to generate">
            <input name="fieldKey" defaultValue={f?.field_key} className={inputCls} placeholder="server_region" />
          </Field>
          <Field label="Field type">
            <select name="fieldType" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        {needsOptions && (
          <Field label="Options" hint="One per line">
            <textarea
              name="options"
              rows={3}
              defaultValue={f?.options ? (JSON.parse(f.options) as string[]).join("\n") : ""}
              className={inputCls}
              placeholder={"Asia\nEurope\nNorth America"}
            />
          </Field>
        )}

        <Field label="Sort order">
          <input name="sortOrder" type="number" defaultValue={f?.sort_order ?? 0} className={inputCls} />
        </Field>

        <div className="space-y-1.5 rounded-xl soft p-3 text-[12px]">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="required" defaultChecked={f?.required === 1} className="accent-brand-600" />
            Required — sellers cannot publish without it
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="showFrontend" defaultChecked={f?.show_frontend !== 0} className="accent-brand-600" />
            Show in frontend — buyers see this on the product page
          </label>
        </div>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save field
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
