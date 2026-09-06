"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { saveOptionAction, deleteOptionAction } from "@/lib/actions/admin";

type O = {
  id: string; list_key: string; value: string; label: string;
  sort_order: number; active: number;
};
type L = { key: string; name: string };

export default function OptionsManager({ lists, list, rows }: { lists: L[]; list: string; rows: O[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<O | "new" | null>(null);
  const [busy, start] = useTransition();

  const remove = (o: O) => {
    if (!confirm(`Remove “${o.label}” from this dropdown?`)) return;
    start(async () => {
      await deleteOptionAction(o.id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <div className="flex flex-wrap gap-1.5">
          {lists.map((l) => (
            <Link
              key={l.key}
              href={`/admin/options?list=${l.key}`}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                list === l.key ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
              }`}
            >
              {l.name}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> Add option
          </Btn>
        </div>
      </Toolbar>

      <p className="text-[11.5px] muted">
        {rows.length} options in this list. They appear in the product form dropdowns immediately.
      </p>

      {rows.length === 0 ? (
        <Empty title="Empty list" sub="Add the first option for this dropdown." />
      ) : (
        <Table head={["Label", "Stored value", "Order", "Status", ""]}>
          {rows.map((o) => (
            <Tr key={o.id}>
              <Td className="font-semibold">{o.label}</Td>
              <Td className="font-mono text-[11px] muted">{o.value}</Td>
              <Td className="muted">{o.sort_order}</Td>
              <Td>
                <Tag tone={o.active === 1 ? "green" : "slate"}>{o.active === 1 ? "Active" : "Hidden"}</Tag>
              </Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <IconAction title="Edit" onClick={() => setEdit(o)}><Pencil size={12} /></IconAction>
                  <IconAction title="Remove" danger disabled={busy} onClick={() => remove(o)}>
                    <Trash2 size={12} />
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <AnimatePresence>
        {edit && (
          <Form o={edit === "new" ? null : edit} listKey={list} count={rows.length} onClose={() => setEdit(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Form({ o, listKey, count, onClose }: { o: O | null; listKey: string; count: number; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveOptionAction(fd);
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
        className="w-full max-w-[420px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{o ? "Edit option" : "Add option"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={o?.id ?? ""} />
        <input type="hidden" name="listKey" value={listKey} />

        <Field label="Label" hint="Exactly what admins and sellers will see">
          <input name="label" required defaultValue={o?.label} className={inputCls} placeholder="Player ID + Zone ID" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stored value" hint="Leave blank to generate">
            <input name="value" defaultValue={o?.value} className={inputCls} />
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={o?.sort_order ?? count} className={inputCls} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" name="active" defaultChecked={o ? o.active === 1 : true} className="accent-brand-600" />
          Active — show in dropdowns
        </label>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
