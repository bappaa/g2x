"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { adminOrderStatusAction, adminRefundAction } from "@/lib/actions/admin";
import LocalTime from "@/components/LocalTime";

type O = {
  id: string; code: string; buyer_name: string; buyer_email: string; total: number;
  status: string; items: number; first_title: string; created_at: string;
};

const STATUSES = ["pending_payment", "paid", "processing", "delivered", "completed", "cancelled", "refunded", "disputed"];

export default function OrdersManager({ rows, q }: { rows: O[]; q: string }) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const [modal, setModal] = useState<{ o: O; mode: "status" | "refund" } | null>(null);

  return (
    <div className="space-y-3">
      <Toolbar>
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/admin/orders?q=${encodeURIComponent(term)}`);
          }}
        >
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input className={`${inputCls} pl-8`} placeholder="Order code or buyer email…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
        <span className="text-[11.5px] muted">{rows.length} orders</span>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No orders" sub="Nothing matches this filter." />
      ) : (
        <Table head={["Order", "Buyer", "Items", "Total", "Status", "Placed", ""]}>
          {rows.map((o) => (
            <Tr key={o.id}>
              <Td>
                <div className="font-mono text-[11.5px] font-bold">{o.code}</div>
                <div className="line-clamp-1 text-[10.5px] muted">{o.first_title}</div>
              </Td>
              <Td>
                <div className="text-[12px] font-medium">{o.buyer_name}</div>
                <div className="text-[10px] muted">{o.buyer_email}</div>
              </Td>
              <Td className="muted">{o.items}</Td>
              <Td className="font-bold">{money(o.total)}</Td>
              <Td><Tag tone={statusTone(o.status)}>{label(o.status)}</Tag></Td>
              <Td className="whitespace-nowrap muted"><LocalTime at={o.created_at} /></Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <IconAction title="Change status" onClick={() => setModal({ o, mode: "status" })}>
                    <Settings2 size={12} />
                  </IconAction>
                  <IconAction title="Refund" danger onClick={() => setModal({ o, mode: "refund" })}>
                    <RotateCcw size={12} />
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <AnimatePresence>
        {modal && <OrderModal {...modal} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}

function OrderModal({ o, mode, onClose }: { o: O; mode: "status" | "refund"; onClose: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(o.status);
  const [amount, setAmount] = useState(String(o.total));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setErr("");
      const r =
        mode === "status"
          ? await adminOrderStatusAction(o.code, status, note)
          : await adminRefundAction(o.code, Number(amount), note);
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
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">
            {mode === "status" ? "Update order status" : "Issue a refund"}
          </h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <div className="rounded-lg soft p-2.5 text-[11.5px]">
          <span className="font-mono font-bold">{o.code}</span> · {o.buyer_name} · {money(o.total)}
        </div>

        {mode === "status" ? (
          <Field label="New status">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Refund amount" hint={`Maximum ${money(o.total)} — credited to the buyer's wallet`}>
            <input className={inputCls} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}

        <Field label="Reason / note to the buyer">
          <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending} onClick={save}>
            {pending && <Loader2 size={13} className="animate-spin" />}
            {mode === "status" ? "Save status" : "Refund buyer"}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.div>
    </motion.div>
  );
}
