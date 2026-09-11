"use client";
import { useMoney } from "@/components/LocaleProvider";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Gavel, MessageSquare, Loader2, PartyPopper, ShieldAlert } from "lucide-react";
import Credentials from "@/components/dash/Credentials";
import { Btn, Tag, Section, inputCls } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { openDisputeAction, startThreadAction } from "@/lib/actions/shop";
import OrderReview from "./OrderReview";
import LocalTime from "@/components/LocalTime";
import { img } from "@/lib/img";

type Order = {
  code: string; subtotal: number; fee: number; total: number; status: string;
  payment_status: string; payment_method: string; delivery_uid: string;
  buyer_note: string | null; created_at: string;
  /** When escrow auto-releases to the seller (stamped at delivery). */
  release_at?: string | null;
};
type Item = {
  id: string; title: string; subtitle: string; image: string; href: string; seller_id: string;
  store_name: string; unit_price: number; qty: number; line_total: number; status: string;
  delivery_time: string; credentials: string | null; kyc_locked?: number;
};
type Ev = { id: string; label: string; actor: string; created_at: string };

const STEPS = ["Order Placed", "Payment Confirmed", "Seller Processing", "Delivered", "Completed"];

export default function OrderDetail({
  order, items, events, review,
}: {
  order: Order; items: Item[]; events: Ev[];
  review?: { sellerId: string; storeName: string; reviewed: boolean };
}) {
  const money = useMoney();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const releaseAt = order.release_at ?? null;

  const done = new Set(events.map((e) => e.label));
  const stepIdx = Math.max(
    0,
    STEPS.reduce((acc, s, i) => (done.has(s) ? i : acc), 0)
  );

  const act = (
    fn: () => Promise<{ ok: boolean; error?: string; id?: string }>,
    okMsg: string,
    /** When the action returns a thread id, open that conversation. */
    gotoThread = false
  ) => {
    setErr(""); setMsg("");
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErr(r.error || "Something went wrong.");
      setMsg(okMsg);
      if (gotoThread && r.id) {
        // The dispute banner now lives in the conversation — take the buyer
        // straight to it instead of leaving them on a page that can't show it.
        router.push(`/dashboard/messages?t=${r.id}`);
        return;
      }
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
        <span className="text-[11.5px] muted"><LocalTime at={order.created_at} /></span>
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
                      <Image src={img(it.image)} alt="" fill sizes="48px" className="object-cover" />
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

                  {it.kyc_locked ? (
                    /* Credentials are stripped server-side until KYC passes —
                       explain why rather than showing an empty panel. */
                    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
                      <ShieldAlert size={16} className="mt-px shrink-0 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-bold text-amber-300">
                          Verify your identity to unlock your delivery
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-amber-200/90">
                          Your payment went through and this order is secured. We just need a quick
                          ID check before releasing the details for orders of this value.
                        </p>
                        <Link
                          href="/dashboard/verification"
                          className="mt-2 inline-block rounded-lg bg-amber-500 px-3 py-1.5 text-[11.5px] font-bold text-black"
                        >
                          Verify now
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <Credentials id={it.id} json={it.credentials} />
                  )}
                </div>
              ))}
            </div>
          </Section>

          {review?.sellerId && ["delivered", "completed"].includes(order.status) && (
            <OrderReview
              orderCode={order.code}
              sellerId={review.sellerId}
              storeName={review.storeName}
              reviewed={review.reviewed}
            />
          )}

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
                      <LocalTime at={e.created_at} /> · {e.actor}
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

            {/*
              "Confirm Receipt" was removed on purpose. Escrow now releases
              automatically 7 days after delivery, so a buyer who never returns
              can no longer leave the seller's money frozen indefinitely.
              Opening a dispute pauses that timer.
            */}
            {order.status === "delivered" && releaseAt && (
              <div className="mb-2 rounded-lg border border-[var(--line)] soft px-3 py-2 text-[11.5px]">
                <div className="font-semibold">Buyer protection active</div>
                <div className="mt-0.5 muted">
                  Funds are released to the seller on{" "}
                  <LocalTime at={releaseAt} mode="date" />. Open a dispute before then if
                  anything is wrong.
                </div>
              </div>
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
                {/*
                  The Submit button used to stay disabled until 10 characters
                  were typed, with nothing on screen explaining why — it just
                  looked broken. Now it is always clickable and the character
                  requirement is stated up front.
                */}
                <div className="mt-1 text-[10.5px] muted">
                  {reason.trim().length < 10
                    ? `Please add at least ${10 - reason.trim().length} more character${
                        10 - reason.trim().length === 1 ? "" : "s"
                      }.`
                    : "Ready to submit."}
                </div>
                <div className="mt-2 flex gap-2">
                  <Btn
                    className="flex-1"
                    disabled={pending}
                    onClick={() => {
                      if (reason.trim().length < 10) {
                        setErr("Please describe the problem in at least 10 characters.");
                        return;
                      }
                      act(
                        () => openDisputeAction(order.code, reason),
                        "Dispute submitted — opening your conversation with the seller…",
                        true
                      );
                    }}
                  >
                    {pending && <Loader2 size={13} className="animate-spin" />} Submit
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
