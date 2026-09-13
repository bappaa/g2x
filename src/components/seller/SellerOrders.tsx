"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Truck, XCircle, Plus, Loader2, User, MessageSquare } from "lucide-react";
import { Btn, Empty, Tag, inputCls } from "@/components/ui";
import Credentials from "@/components/dash/Credentials";
import { statusTone, label } from "@/lib/fmt";
import { deliverOrderAction, cancelOrderItemAction } from "@/lib/actions/seller";
import { startThreadAction } from "@/lib/actions/shop";
import LocalTime from "@/components/LocalTime";
import { img } from "@/lib/img";
import { useMoney } from "@/components/LocaleProvider";

type OI = {
  id: string; code: string; title: string; subtitle: string; image: string; qty: number;
  unit_price: number; line_total: number; seller_net: number; commission_amt: number;
  status: string; created_at: string; delivery_uid: string; buyer_note: string | null;
  buyer_name: string; buyer_email: string; buyer_id: string; delivery_time: string;
  opt_region?: string | null; opt_delivery?: string | null;
  credentials: string | null;
  category_slug?: string | null;
};

export default function SellerOrders({ orders }: { orders: OI[] }) {
  if (!orders.length)
    return <Empty title="No orders in this view" sub="Keep your offers competitive to win more sales." />;
  return (
    <div className="space-y-2.5">
      {orders.map((o) => (
        <OrderRow key={o.id} o={o} />
      ))}
    </div>
  );
}

function OrderRow({ o }: { o: OI }) {
  const money = useMoney();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState([{ label: "Code", value: "" }]);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"deliver" | "cancel" | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const canAct = o.status === "processing";

  return (
    <motion.div layout className="rounded-2xl panel p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-3 text-left">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg soft">
          <Image src={img(o.image)} alt="" fill sizes="48px" className="object-cover" />
        </div>
        <div className="min-w-[170px] flex-1">
          <div className="line-clamp-1 text-[13px] font-bold">{o.title}</div>
          <div className="text-[11px] muted">
            {o.code} · {o.buyer_name} · <LocalTime at={o.created_at} />
          </div>
        </div>
        <Tag tone={statusTone(o.status)}>{label(o.status)}</Tag>
        <div className="text-right">
          <div className="text-[14px] font-black text-brand-500">{money(o.line_total)}</div>
          <div className="text-[10.5px] muted">net {money(o.seller_net)}</div>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Info l="Buyer" v={o.buyer_name} icon={User} />
            <Info l="Delivery UID" v={o.delivery_uid} />
            <Info l="Quantity" v={`${o.qty} × ${money(o.unit_price)}`} />
            {o.opt_region && <Info l="Game server" v={o.opt_region} />}
            {o.opt_delivery && <Info l="Delivery method" v={o.opt_delivery} />}
            <Info l="Commission" v={`− ${money(o.commission_amt)}`} />
            {o.buyer_note && <Info l="Buyer note" v={o.buyer_note} />}
          </div>

          {o.credentials && <Credentials id={o.id} json={o.credentials} category={o.category_slug} audience="seller" />}

          {err && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

          {canAct && mode === null && (
            <div className="flex flex-wrap gap-2">
              <Btn className="flex items-center gap-1.5" onClick={() => setMode("deliver")}>
                <Truck size={13} /> Deliver now
              </Btn>
              <Btn
                variant="ghost"
                className="flex items-center gap-1.5"
                onClick={() =>
                  start(async () => {
                    const r = await startThreadAction(o.buyer_id, o.code);
                    if (r.ok) router.push("/dashboard/messages");
                  })
                }
              >
                <MessageSquare size={13} /> Message buyer
              </Btn>
              <button
                onClick={() => setMode("cancel")}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] font-semibold text-rose-400 hover:bg-rose-500/10"
              >
                <XCircle size={13} /> Cancel & refund
              </button>
            </div>
          )}

          {mode === "deliver" && (
            <div className="rounded-xl soft p-3">
              <div className="mb-2 text-[12px] font-semibold">Delivery details for the buyer</div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={`${inputCls} max-w-[150px]`}
                      placeholder="Label"
                      value={f.label}
                      onChange={(e) =>
                        setFields((fs) => fs.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    <input
                      className={inputCls}
                      placeholder="Value (code / login / note)"
                      value={f.value}
                      onChange={(e) =>
                        setFields((fs) => fs.map((x, j) => (i === j ? { ...x, value: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setFields((f) => [...f, { label: "", value: "" }])}
                className="mt-2 flex items-center gap-1 text-[11.5px] text-brand-400 hover:underline"
              >
                <Plus size={12} /> Add field
              </button>
              <div className="mt-3 flex gap-2">
                <Btn
                  className="flex items-center gap-2"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setErr("");
                      const r = await deliverOrderAction(o.id, fields);
                      if (!r.ok) return setErr(r.error || "Delivery failed.");
                      setMode(null);
                      router.refresh();
                    })
                  }
                >
                  {pending && <Loader2 size={13} className="animate-spin" />} Mark delivered
                </Btn>
                <Btn variant="ghost" onClick={() => setMode(null)}>Cancel</Btn>
              </div>
            </div>
          )}

          {mode === "cancel" && (
            <div className="rounded-xl soft p-3">
              <textarea
                rows={2}
                className={inputCls}
                placeholder="Why are you cancelling? The buyer is refunded in full."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <Btn
                  className="flex items-center gap-2"
                  disabled={pending || reason.trim().length < 5}
                  onClick={() =>
                    start(async () => {
                      setErr("");
                      const r = await cancelOrderItemAction(o.id, reason);
                      if (!r.ok) return setErr(r.error || "Could not cancel.");
                      setMode(null);
                      router.refresh();
                    })
                  }
                >
                  {pending && <Loader2 size={13} className="animate-spin" />} Confirm cancellation
                </Btn>
                <Btn variant="ghost" onClick={() => setMode(null)}>Back</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Info({ l, v, icon: Icon }: { l: string; v: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-lg soft px-3 py-2">
      <div className="flex items-center gap-1 text-[10.5px] muted">
        {Icon && <Icon size={10} />} {l}
      </div>
      <div className="text-[12px] font-medium">{v}</div>
    </div>
  );
}
