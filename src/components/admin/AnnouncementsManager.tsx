"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Megaphone } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Toolbar, IconAction } from "@/components/admin/ui";

import { saveAnnouncementAction, deleteAnnouncementAction } from "@/lib/actions/admin";
import LocalTime from "@/components/LocalTime";

type A = {
  id: string; title: string; body: string; tone: string; active: number; created_at: string;
};

const TONES: Record<string, string> = {
  info: "border-brand-500/40 bg-brand-600/10",
  success: "border-emerald-500/40 bg-emerald-500/10",
  warning: "border-amber-500/40 bg-amber-500/10",
  danger: "border-rose-500/40 bg-rose-500/10",
};

export default function AnnouncementsManager({ rows }: { rows: A[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<A | "new" | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <Toolbar>
        <span className="text-[11.5px] muted">{rows.length} announcements</span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> New announcement
          </Btn>
        </div>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="Nothing announced" sub="Publish a message to the site-wide banner." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {rows.map((a) => (
            <motion.div
              key={a.id}
              layout
              className={`rounded-2xl border p-4 ${TONES[a.tone] ?? TONES.info}`}
            >
              <div className="flex items-start gap-2">
                <Megaphone size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{a.title}</div>
                  <p className="mt-0.5 text-[11.5px] muted">{a.body}</p>
                  <div className="mt-1 text-[10px] muted"><LocalTime at={a.created_at} /></div>
                </div>
                <Tag tone={a.active === 1 ? "green" : "slate"}>{a.active === 1 ? "Live" : "Off"}</Tag>
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                <IconAction title="Edit" onClick={() => setEdit(a)}><Pencil size={12} /></IconAction>
                <IconAction
                  title="Delete" danger disabled={busy}
                  onClick={() => {
                    if (!confirm("Delete this announcement?")) return;
                    start(async () => { await deleteAnnouncementAction(a.id); router.refresh(); });
                  }}
                >
                  <Trash2 size={12} />
                </IconAction>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {edit && <Form a={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Form({ a, onClose }: { a: A | null; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveAnnouncementAction(fd);
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
        className="w-full max-w-[460px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{a ? "Edit announcement" : "New announcement"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={a?.id ?? ""} />
        <Field label="Title">
          <input name="title" required defaultValue={a?.title} className={inputCls} placeholder="Summer sale — 15% off all top-ups" />
        </Field>
        <Field label="Body">
          <textarea name="body" rows={3} defaultValue={a?.body} className={inputCls} />
        </Field>
        <Field label="Tone">
          <select name="tone" defaultValue={a?.tone ?? "info"} className={inputCls}>
            <option value="info">Info (purple)</option>
            <option value="success">Success (green)</option>
            <option value="warning">Warning (amber)</option>
            <option value="danger">Urgent (red)</option>
          </select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" name="active" defaultChecked={a?.active !== 0} className="accent-brand-600" />
          Show live on the site
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
