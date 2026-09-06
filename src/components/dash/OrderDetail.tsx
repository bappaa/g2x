"use client";
import { useMoney } from "@/components/LocaleProvider";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Gavel, MessageSquare, Loader2, PartyPopper } from "lucide-react";
import Credentials from "@/components/dash/Credentials";
import { Btn, Tag, Section, inputCls } from "@/components/ui";
import { when, statusTone, label } from "@/lib/fmt";
import { confirmReceiptAction, openDisputeAction, startThreadAction } from "@/lib/actions/shop";

type Order = {
  code: string; subtotal: number; fee: number; total: number; status: string;
  payment_status: string; payment_method: string; delivery_uid: string;
  buyer_note: string | null; created_at: string;
};
type Item = {
  id: string; title: string; subtitle: string; image: string; href: string; seller_id: string;
  store_name: string; unit_price: number; qty: number; line_total: number; status: string;
  delivery_time: string; credentials: string | null;
};
type Ev = { id: string; label: string; actor: string; created_at: string };

const STEPS = ["Order Placed", "Payment Confirmed", "Seller Processing", "Delivered", "Completed"];

export default function OrderDetail({
  order, items, events,
}: {
  order: Order; items: Item[]; events: Ev[];
}) {
  const money = useMoney();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const done = new Set(events.map((e) => e.label));
  const stepIdx = Math.max(
    0,
    STEPS.reduce((acc, s, i) => (done.has(s) ? i : acc), 0)
  );

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setErr(""); setMsg("");
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErr(r.error || "Something went wrong.");
      setMsg(okMsg);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {isNew && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[12.5px] text-emerald-400"
        >
          <PartyPopper size={15} /> Payment received! Your order is being delivered now.
        </motion.div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Order {order.code}</h1>
        <Tag tone={statusTone(order.status)}>{label(order.status)}</Tag>
        <Tag tone={order.payment_status === "paid" ? "green" : "amber"}>
          {label(order.payment_status)}
        </Tag>
        <span className="text-[11.5px] muted">{when(order.created_at)}</span>
      </div>

      {/* progress */}
      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex flex-wrap gap-y-4">
          {STEPS.map((s, i) => {
            const on = i <= stepIdx && !["cancelled", "refunded"].includes(order.status);
            return (
              <div key={s} className="flex min-w-[110px] flex-1 items-center gap-2">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    on ? "bg-brand-600 text-white" : "soft muted"
                  }`}
                >
                  {on ? <Check size={13} /> : i + 1}
                </span>
                <span className={`text-[11.5px] ${on ? "font-semibold" : "muted"}`}>{s}</span>
                {i < STEPS.length - 1 && (
                  <span className={`mx-1 hidden h-px flex-1 sm:block ${on ? "bg-brand-600" : "bg-[var(--line)]"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Section title="Items">
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl soft p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                      <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={it.href || "#"} className="line-clamp-1 text-[12.5px] font-bold hover:text-brand-500">
                        {it.title}
                      </Link>
                      <div className="text-[11px] muted">
                        {it.subtitle} · {it.store_name} · ×{it.qty}
                      </div>
                    </div>
                    <Tag tone={statusTone(it.status)}>{label(it.status)}</Tag>
                    <div className="w-[70px] text-right text-[13px] font-bold">{money(it.line_total)}</div>
                  </div>

                  <Credentials id={it.id} json={it.credentials} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Order Timeline">
            <div className="space-y-3">
              {events.map((e, i) => (
                <div key={e.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                    {i < events.length - 1 && <span className="w-px flex-1 bg-[var(--line)]" />}
                  </div>
                  <div className="pb-3">
                    <div className="text-[12.5px] font-semibold">{e.label}</div>
                    <div className="text-[10.5px] muted">
                      {when(e.created_at)} · {e.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl panel p-4 sm:p-5">
            <h3 className="text-[14px] font-bold">Payment</h3>
            <div className="mt-3 space-y-2 text-[12.5px]">
              <Row l="Subtotal" v={money(order.subtotal)} />
              <Row l="Service fee" v={money(order.fee)} />
              <Row l="Method" v={order.payment_method} />
              <div className="my-2 h-px bg-[var(--line)]" />
              <div className="flex justify-between">
                <span className="font-bold">Total</span>
                <span className="text-[18px] font-black text-brand-500">{money(order.total)}</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg soft p-2.5 text-[11.5px]">
              <div className="muted">Delivery UID</div>
              <div className="font-mono">{order.delivery_uid}</div>
              {order.buyer_note && <div className="mt-1.5 muted">Note: {order.buyer_note}</div>}
            </div>
          </div>

          <div className="rounded-2xl panel p-4 sm:p-5">
            <h3 className="mb-3 text-[14px] font-bold">Actions</h3>
            {msg && <div className="mb-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-400">{msg}</div>}
            {err && <div className="mb-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

            {order.status === "delivered" && (
              <Btn
                className="mb-2 flex w-full items-center justify-center gap-2"
                disabled={pending}
                onClick={() => act(() => confirmReceiptAction(order.code), "Receipt confirmed — seller paid.")}
              >
                {pending && <Loader2 size={13} className="animate-spin" />} Confirm Receipt
              </Btn>
            )}

            <Btn
              variant="ghost"
              className="mb-2 flex w-full items-center justify-center gap-2"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await startThreadAction(items[0]?.seller_id, order.code);
                  if (r.ok) router.push("/dashboard/messages");
                  else setErr(r.error || "Could not open chat.");
                })
              }
            >
              <MessageSquare size={13} /> Contact Seller
            </Btn>

            {!showDispute ? (
              <button
                onClick={() => setShowDispute(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12.5px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/10"
              >
                <Gavel size={13} /> Open a Dispute
              </button>
            ) : (
              <div className="rounded-lg soft p-3">
                <textarea
                  rows={3}
                  className={inputCls}
                  placeholder="Tell us what went wrong…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Btn
                    className="flex-1"
                    disabled={pending || reason.trim().length < 10}
                    onClick={() =>
                      act(() => openDisputeAction(order.code, reason), "Dispute submitted. Support will review it.")
                    }
                  >
                    Submit
                  </Btn>
                  <Btn variant="ghost" onClick={() => setShowDispute(false)}>
                    Cancel
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="muted">{l}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
