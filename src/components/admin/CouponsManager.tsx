"use client";
import { useState, useTransition } from "react";
import LocalTime from "@/components/LocalTime";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Ticket } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { saveCouponAction, deleteCouponAction } from "@/lib/actions/admin";

type C = {
  id: string; code: string; discount_type: string; discount_value: number; applies_to: string;
  min_order: number; start_date: string | null; end_date: string | null;
  usage_limit: number; usage_per_user: number; used_count: number; status: string;
};

export default function CouponsManager({ rows }: { rows: C[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<C | "new" | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <Toolbar>
        <span className="text-[11.5px] muted">{rows.length} coupons</span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> New coupon
          </Btn>
        </div>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No coupons yet" sub="Create your first discount code." />
      ) : (
        <Table head={["Code", "Discount", "Applies to", "Min order", "Used", "Window", "Status", ""]}>
          {rows.map((c) => (
            <Tr key={c.id}>
              <Td>
                <span className="flex items-center gap-1.5 font-mono font-bold">
                  <Ticket size={12} className="text-brand-400" /> {c.code}
                </span>
              </Td>
              <Td className="font-semibold">
                {c.discount_type === "percent" ? `${Number(c.discount_value)}%` : money(c.discount_value)}
              </Td>
              <Td className="capitalize muted">{c.applies_to}</Td>
              <Td className="muted">{c.min_order ? money(c.min_order) : "—"}</Td>
              <Td className="muted">
                {Number(c.used_count ?? 0)}{c.usage_limit ? ` / ${c.usage_limit}` : ""}
              </Td>
              <Td className="text-[10.5px] muted">
                {c.start_date ? <LocalTime at={c.start_date} mode="date" /> : "Always"} → {c.end_date ? <LocalTime at={c.end_date} mode="date" /> : "No end"}
              </Td>
              <Td><Tag tone={statusTone(c.status)}>{label(c.status)}</Tag></Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <IconAction title="Edit" onClick={() => setEdit(c)}><Pencil size={12} /></IconAction>
                  <IconAction
                    title="Delete" danger disabled={busy}
                    onClick={() => {
                      if (!confirm(`Delete coupon ${c.code}?`)) return;
                      start(async () => { await deleteCouponAction(c.id); router.refresh(); });
                    }}
                  >
                    <Trash2 size={12} />
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <AnimatePresence>
        {edit && <Form c={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Form({ c, onClose }: { c: C | null; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveCouponAction(fd);
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
          <h2 className="text-[15px] font-black">{c ? "Edit coupon" : "New coupon"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={c?.id ?? ""} />

        <Field label="Code">
          <input name="code" required defaultValue={c?.code} className={`${inputCls} font-mono uppercase`} placeholder="WELCOME10" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discount type">
            <select name="discountType" defaultValue={c?.discount_type ?? "percent"} className={inputCls}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </Field>
          <Field label="Value">
            <input name="discountValue" type="number" step="0.01" required defaultValue={c?.discount_value} className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Applies to">
            <select name="appliesTo" defaultValue={c?.applies_to ?? "all"} className={inputCls}>
              <option value="all">All products</option>
              <option value="top-up">Top Up</option>
              <option value="currency">Currency</option>
              <option value="accounts">Accounts</option>
              <option value="items">Items</option>
              <option value="boosting">Boosting</option>
              <option value="subscriptions">Subscriptions</option>
            </select>
          </Field>
          <Field label="Minimum order">
            <input name="minOrder" type="number" step="0.01" defaultValue={c?.min_order ?? 0} className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts">
            <input name="startDate" type="date" defaultValue={c?.start_date?.slice(0, 10) ?? ""} className={inputCls} />
          </Field>
          <Field label="Ends">
            <input name="endDate" type="date" defaultValue={c?.end_date?.slice(0, 10) ?? ""} className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Total uses" hint="0 = unlimited">
            <input name="usageLimit" type="number" defaultValue={c?.usage_limit ?? 0} className={inputCls} />
          </Field>
          <Field label="Uses per customer">
            <input name="usagePerUser" type="number" defaultValue={c?.usage_per_user ?? 1} className={inputCls} />
          </Field>
        </div>
        <Field label="Status">
          <select name="status" defaultValue={c?.status ?? "active"} className={inputCls}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </Field>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save coupon
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
