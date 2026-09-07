"use client";
import TimeAgo from "@/components/TimeAgo";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Send, Loader2 } from "lucide-react";
import { Btn, Empty, Tag, inputCls } from "@/components/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { disputeReplyAction } from "@/lib/actions/shop";
import MonitorNotice from "@/components/MonitorNotice";
import LocalTime from "@/components/LocalTime";

type D = { id: string; code: string; amount: number; reason: string; status: string; resolution: string | null; created_at: string; buyer_name: string };
type M = { id: string; dispute_id: string; sender: string; body: string; created_at: string };

export default function SellerDisputes({ disputes, messages }: { disputes: D[]; messages: M[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  if (!disputes.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Disputes</h1>
        <Empty title="No disputes" sub="Great — buyers are happy with your deliveries." />
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Disputes</h1>
      {disputes.map((d) => {
        const thread = messages.filter((m) => m.dispute_id === d.id);
        return (
          <div key={d.code} className="rounded-2xl panel p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-500/15 text-rose-400">
                <Gavel size={15} />
              </span>
              <div className="min-w-[170px] flex-1">
                <div className="line-clamp-1 text-[12.5px] font-bold">{d.reason}</div>
                <div className="text-[11px] muted">
                  {d.code} · {d.buyer_name} · <LocalTime at={d.created_at} />
                </div>
              </div>
              <Tag tone={statusTone(d.status)}>{label(d.status)}</Tag>
              <div className="text-[14px] font-black">{money(d.amount)}</div>
            </div>

            <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-[12px] ${
                    m.sender === "seller" ? "ml-auto bg-brand-600 text-white" : "soft"
                  }`}
                >
                  <div className="mb-0.5 text-[10px] capitalize opacity-70">
                    {m.sender} · <TimeAgo at={m.created_at} />
                  </div>
                  {m.body}
                </div>
              ))}
              {!["resolved", "rejected"].includes(d.status) && (
                <>
                <div className="pt-1"><MonitorNotice /></div>
                <div className="flex gap-2 pt-2">
                  <input className={inputCls} placeholder="Respond with evidence…" value={text} onChange={(e) => setText(e.target.value)} />
                  <Btn
                    disabled={pending || !text.trim()}
                    onClick={() =>
                      start(async () => {
                        await disputeReplyAction(d.code, text);
                        setText("");
                        router.refresh();
                      })
                    }
                  >
                    {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </Btn>
                </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
