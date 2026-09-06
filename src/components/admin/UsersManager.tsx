"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Ban, CheckCircle2, Wallet, X, Loader2 } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { money, day, statusTone, label } from "@/lib/fmt";
import { userStatusAction, adjustBalanceAction } from "@/lib/actions/admin";

type U = {
  id: string; name: string; email: string; role: string; status: string;
  balance: number; is_seller: number; country: string | null; created_at: string;
  orders: number; spent: number;
};

export default function UsersManager({ rows, q }: { rows: U[]; q: string }) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const [wallet, setWallet] = useState<U | null>(null);
  const [busy, start] = useTransition();

  const toggle = (u: U) => {
    const next = u.status === "suspended" ? "active" : "suspended";
    if (next === "suspended" && !confirm(`Suspend ${u.email}? They will be logged out immediately.`)) return;
    start(async () => {
      await userStatusAction(u.id, next);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => { e.preventDefault(); router.push(`/admin/users?q=${encodeURIComponent(term)}`); }}
        >
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input className={`${inputCls} pl-8`} placeholder="Name or email…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
        <span className="text-[11.5px] muted">{rows.length} accounts</span>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No users" sub="Nothing matches this search." />
      ) : (
        <Table head={["User", "Role", "Orders", "Spent", "Wallet", "Joined", "Status", ""]}>
          {rows.map((u) => (
            <Tr key={u.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-600 text-[11px] font-black text-white">
                    {u.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-[10px] muted">{u.email}</div>
                  </div>
                </div>
              </Td>
              <Td>
                <Tag tone={u.role === "admin" ? "brand" : u.is_seller ? "green" : "slate"}>
                  {u.role === "admin" ? "Admin" : u.is_seller ? "Seller" : "Buyer"}
                </Tag>
              </Td>
              <Td className="muted">{u.orders}</Td>
              <Td className="muted">{money(u.spent)}</Td>
              <Td className="font-semibold">{money(u.balance)}</Td>
              <Td className="whitespace-nowrap muted">{day(u.created_at)}</Td>
              <Td><Tag tone={statusTone(u.status)}>{label(u.status)}</Tag></Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <IconAction title="Adjust balance" onClick={() => setWallet(u)}><Wallet size={12} /></IconAction>
                  <IconAction
                    title={u.status === "suspended" ? "Reactivate" : "Suspend"}
                    danger={u.status !== "suspended"}
                    disabled={busy}
                    onClick={() => toggle(u)}
                  >
                    {u.status === "suspended" ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <AnimatePresence>
        {wallet && <WalletModal u={wallet} onClose={() => setWallet(null)} />}
      </AnimatePresence>
    </div>
  );
}

function WalletModal({ u, onClose }: { u: U; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setErr("");
      const r = await adjustBalanceAction(u.id, Number(amount), reason);
      if (!r.ok) return setErr(r.error || "Could not adjust.");
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
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">Adjust wallet</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <div className="rounded-lg soft p-2.5 text-[11.5px]">
          {u.email} · current balance <span className="font-bold">{money(u.balance)}</span>
        </div>
        <Field label="Amount" hint="Use a negative number to deduct funds">
          <input className={inputCls} type="number" step="0.01" placeholder="25.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Reason (shown on their statement)">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goodwill credit" />
        </Field>
        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending || !amount} onClick={save}>
            {pending && <Loader2 size={13} className="animate-spin" />} Apply
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.div>
    </motion.div>
  );
}
