"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, Banknote, Send } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, IconAction } from "@/components/admin/ui";
import { money, when, statusTone, label } from "@/lib/fmt";
import { reviewWithdrawalAction } from "@/lib/actions/admin";

type W = {
  id: string; seller_id: string; name: string; email: string; store_name: string | null;
  amount: number; method: string; destination: string; status: string;
  admin_note: string | null; available_bal: number; created_at: string;
};

export default function WithdrawalsManager({ rows }: { rows: W[] }) {
  const [modal, setModal] = useState<{ w: W; d: "approved" | "paid" | "rejected" } | null>(null);

  if (!rows.length) return <Empty title="No withdrawals" sub="Nothing matches this filter." />;

  return (
    <div className="space-y-3">
      <Table head={["Seller", "Amount", "Method", "Destination", "Requested", "Status", ""]}>
        {rows.map((w) => (
          <Tr key={w.id}>
            <Td>
              <div className="font-semibold">{w.store_name || w.name}</div>
              <div className="text-[10px] muted">{w.email}</div>
            </Td>
            <Td className="font-bold text-emerald-400">{money(w.amount)}</Td>
            <Td className="capitalize muted">{w.method}</Td>
            <Td className="max-w-[180px] truncate text-[11px] muted">{w.destination}</Td>
            <Td className="whitespace-nowrap muted">{when(w.created_at)}</Td>
            <Td><Tag tone={statusTone(w.status)}>{label(w.status)}</Tag></Td>
            <Td>
              <div className="flex justify-end gap-1.5">
                {w.status === "pending" && (
                  <IconAction title="Approve" onClick={() => setModal({ w, d: "approved" })}><Check size={12} /></IconAction>
                )}
                {["pending", "approved"].includes(w.status) && (
                  <>
                    <IconAction title="Mark as paid" onClick={() => setModal({ w, d: "paid" })}><Send size={12} /></IconAction>
                    <IconAction title="Reject & return funds" danger onClick={() => setModal({ w, d: "rejected" })}>
                      <X size={12} />
                    </IconAction>
                  </>
                )}
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      <AnimatePresence>
        {modal && <Modal {...modal} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Modal({ w, d, onClose }: { w: W; d: "approved" | "paid" | "rejected"; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setErr("");
      const r = await reviewWithdrawalAction(w.id, d, note);
      if (!r.ok) return setErr(r.error || "Could not save.");
      onClose();
      router.refresh();
    });

  const copy = {
    approved: "Approve this payout — the seller is told it is being processed.",
    paid: "Confirm the money has actually left your payout provider.",
    rejected: "Reject and return the funds to the seller's available balance.",
  }[d];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center gap-2">
          <Banknote size={16} className="text-emerald-400" />
          <h2 className="text-[15px] font-black capitalize">{d === "paid" ? "Mark as paid" : d}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <p className="text-[11.5px] muted">{copy}</p>
        <div className="rounded-lg soft p-2.5 text-[11.5px]">
          <span className="font-bold">{money(w.amount)}</span> → {w.store_name || w.name} · {w.method}
          <div className="mt-0.5 break-all text-[10.5px] muted">{w.destination}</div>
        </div>
        <Field label="Note (reference or reason)">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending} onClick={save}>
            {pending && <Loader2 size={13} className="animate-spin" />} Confirm
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.div>
    </motion.div>
  );
}
