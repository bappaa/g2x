"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gavel, Loader2, Send, ShieldCheck, User as UserIcon, Store } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { money, when, statusTone, label } from "@/lib/fmt";
import MonitorNotice from "@/components/MonitorNotice";
import {
  resolveDisputeAction, disputeStatusAction, adminDisputeReplyAction,
} from "@/lib/actions/admin";

type D = {
  id: string; code: string; order_id: string; order_code: string; amount: number;
  reason: string; status: string; resolution: string | null; created_at: string;
  buyer_name: string; seller_name: string; store_name: string | null;
};
type M = { id: string; sender: string; body: string; created_at: string };

export default function DisputesManager({
  rows, messages, activeCode,
}: {
  rows: D[]; messages: M[]; activeCode: string;
}) {
  const router = useRouter();
  const active = rows.find((r) => r.code === activeCode);

  if (!rows.length) return <Empty title="No disputes" sub="Nothing matches this filter." />;

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      <div className="space-y-1.5">
        {rows.map((d) => (
          <button
            key={d.code}
            onClick={() => router.push(`/admin/disputes?status=${d.status}&code=${d.code}`)}
            className={`w-full rounded-xl border p-2.5 text-left transition-all ${
              d.code === activeCode ? "border-brand-500/50 bg-brand-600/10" : "border-[var(--line)] panel hover:border-brand-500/30"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold">{d.code}</span>
              <Tag tone={statusTone(d.status)}>{label(d.status)}</Tag>
              <span className="ml-auto text-[11.5px] font-bold">{money(d.amount)}</span>
            </div>
            <div className="line-clamp-1 pt-0.5 text-[11px] muted">{d.reason}</div>
            <div className="text-[9.5px] muted">{d.buyer_name} vs {d.store_name || d.seller_name}</div>
          </button>
        ))}
      </div>

      {active ? <Detail d={active} messages={messages} /> : <Empty title="Select a dispute" sub="Pick a case on the left." />}
    </div>
  );
}

function Detail({ d, messages }: { d: D; messages: M[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"chat" | "decide">("chat");
  const [reply, setReply] = useState("");
  const [decision, setDecision] = useState<"buyer" | "seller" | "partial">("buyer");
  const [refundType, setRefundType] = useState<"full" | "partial" | "none">("full");
  const [amount, setAmount] = useState(String(d.amount));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const closed = ["resolved", "rejected"].includes(d.status);

  const submit = () =>
    start(async () => {
      setErr("");
      const r = await resolveDisputeAction({
        code: d.code, decision, refundType, amount: Number(amount), note,
      });
      if (!r.ok) return setErr(r.error || "Could not submit.");
      router.refresh();
    });

  return (
    <div className="space-y-3 rounded-2xl panel p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
        <Gavel size={15} className="text-brand-400" />
        <span className="font-mono text-[13px] font-black">{d.code}</span>
        <Tag tone={statusTone(d.status)}>{label(d.status)}</Tag>
        <span className="ml-auto text-[14px] font-black">{money(d.amount)}</span>
      </div>

      <div className="grid gap-2 text-[11.5px] sm:grid-cols-3">
        <div className="rounded-lg soft p-2.5">
          <div className="flex items-center gap-1 text-[10px] muted"><UserIcon size={10} /> Buyer</div>
          <div className="font-semibold">{d.buyer_name}</div>
        </div>
        <div className="rounded-lg soft p-2.5">
          <div className="flex items-center gap-1 text-[10px] muted"><Store size={10} /> Seller</div>
          <div className="font-semibold">{d.store_name || d.seller_name}</div>
        </div>
        <div className="rounded-lg soft p-2.5">
          <div className="text-[10px] muted">Order</div>
          <div className="font-mono font-semibold">{d.order_code}</div>
        </div>
      </div>

      <div className="rounded-lg soft p-2.5 text-[12px]">
        <span className="muted">Reason: </span>{d.reason}
        <div className="pt-0.5 text-[10px] muted">Opened {when(d.created_at)}</div>
      </div>

      <div className="flex gap-1.5">
        {(["chat", "decide"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
              tab === t ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
            }`}
          >
            {t === "chat" ? "Conversation" : "Decision"}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <div className="space-y-2">
          <MonitorNotice compact />
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {messages.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-0.5 text-[9.5px] capitalize muted">{m.sender} · {when(m.created_at)}</div>
                <div
                  className={`rounded-xl px-3 py-2 text-[12px] ${
                    m.sender === "admin" ? "border border-brand-500/40 bg-brand-600/10" : "soft"
                  }`}
                >
                  {m.body}
                </div>
              </motion.div>
            ))}
          </div>
          {!closed && (
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Ask both parties for evidence…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Btn
                disabled={pending || !reply.trim()}
                onClick={() =>
                  start(async () => {
                    await adminDisputeReplyAction(d.code, reply);
                    setReply("");
                    router.refresh();
                  })
                }
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </Btn>
            </div>
          )}
        </div>
      ) : closed ? (
        <div className="rounded-lg bg-emerald-500/10 p-3 text-[12px]">
          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
            <ShieldCheck size={13} /> Case closed
          </div>
          <div className="mt-1 muted">{d.resolution}</div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Select action">
            <select className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value as never)}>
              <option value="buyer">Rule in favour of the buyer</option>
              <option value="seller">Rule in favour of the seller</option>
              <option value="partial">Partial — split the difference</option>
            </select>
          </Field>
          <Field label="Refund type">
            <select className={inputCls} value={refundType} onChange={(e) => setRefundType(e.target.value as never)}>
              <option value="full">Full refund ({money(d.amount)})</option>
              <option value="partial">Partial refund</option>
              <option value="none">No refund — release escrow to seller</option>
            </select>
          </Field>
          {refundType === "partial" && (
            <Field label="Refund amount">
              <input className={inputCls} type="number" step="0.01" max={d.amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
          <Field label="Admin reason" hint="Sent to both parties and stored permanently">
            <textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
          <div className="flex flex-wrap gap-2">
            <Btn className="flex items-center gap-2" disabled={pending} onClick={submit}>
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Gavel size={13} />} Submit decision
            </Btn>
            {d.status === "open" && (
              <Btn
                variant="ghost"
                disabled={pending}
                onClick={() => start(async () => { await disputeStatusAction(d.code, "under_review"); router.refresh(); })}
              >
                Mark under review
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
