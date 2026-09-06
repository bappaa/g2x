"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, ExternalLink } from "lucide-react";
import { Btn, Tag, Field, inputCls } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { saveCategoryAction, deleteCategoryAction } from "@/lib/actions/admin";

type C = {
  slug: string; name: string; blurb: string | null; icon: string | null;
  status: string; sort_order: number; kind: string | null; games: number; products: number;
};

export default function CategoriesManager({ rows }: { rows: C[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<C | "new" | null>(null);
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
