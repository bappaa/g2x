"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Link2 } from "lucide-react";
import { Btn, Field, inputCls, Empty } from "@/components/ui";
import { Toolbar, IconAction } from "@/components/admin/ui";
import { saveNavLinkAction, deleteNavLinkAction } from "@/lib/actions/admin";

type N = {
  id: string; section: string; label: string; href: string;
  placement: string; sort_order: number; active: number;
};

export default function NavManager({ rows }: { rows: N[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<N | "new" | null>(null);
  const [busy, start] = useTransition();

  const sections: string[] = [];
  const grouped: Record<string, N[]> = {};
  rows.forEach((r) => {
    if (!grouped[r.section]) {
      grouped[r.section] = [];
      sections.push(r.section);
    }
    grouped[r.section].push(r);
  });

  return (
    <div className="space-y-3">
      <Toolbar>
        <span className="text-[11.5px] muted">
          {rows.length} links across {sections.length} columns
        </span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> Add link
          </Btn>
        </div>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No links" sub="The footer will render with no link columns." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((sec) => (
            <motion.div key={sec} layout className="rounded-2xl panel p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[13px] font-bold">{sec}</span>
                <span className="ml-auto text-[10px] muted">{grouped[sec].length}</span>
              </div>
              <div className="space-y-1">
                {grouped[sec].map((l) => (
                  <div
                    key={l.id}
                    className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-600/10"
                  >
                    <Link2 size={10} className="shrink-0 muted" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[11.5px] ${l.active ? "" : "line-through opacity-50"}`}>
                        {l.label}
                      </span>
                      <span className="block truncate text-[9.5px] muted">{l.href}</span>
                    </span>
                    <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <IconAction title="Edit" onClick={() => setEdit(l)}><Pencil size={10} /></IconAction>
                      <IconAction
                        title="Remove" danger disabled={busy}
                        onClick={() => {
                          if (!confirm(`Remove “${l.label}” from the footer?`)) return;
                          start(async () => {
                            await deleteNavLinkAction(l.id);
                            router.refresh();
                          });
                        }}
                      >
                        <Trash2 size={10} />
                      </IconAction>
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {edit && (
          <Form
            n={edit === "new" ? null : edit}
            sections={sections}
            count={rows.length}
            onClose={() => setEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Form({
  n, sections, count, onClose,
}: {
  n: N | null; sections: string[]; count: number; onClose: () => void;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveNavLinkAction(fd);
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
          <h2 className="text-[15px] font-black">{n ? "Edit link" : "Add link"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={n?.id ?? ""} />
        <input type="hidden" name="placement" value="footer" />

        <Field label="Column heading" hint="Reuse an existing name to add to that column">
          <input
            name="section" required list="nav-sections"
            defaultValue={n?.section} className={inputCls} placeholder="Company"
          />
          <datalist id="nav-sections">
            {sections.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>

        <Field label="Link text">
          <input name="label" required defaultValue={n?.label} className={inputCls} placeholder="About Us" />
        </Field>
        <Field label="Link URL">
          <input name="href" required defaultValue={n?.href} className={inputCls} placeholder="/p/about-us" />
        </Field>
        <Field label="Sort order">
          <input name="sortOrder" type="number" defaultValue={n?.sort_order ?? count} className={inputCls} />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" name="active" defaultChecked={n ? n.active === 1 : true} className="accent-brand-600" />
          Show this link
        </label>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save link
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
