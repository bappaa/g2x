"use client";
import TimeAgo from "@/components/TimeAgo";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gavel, Send, Loader2 } from "lucide-react";
import { Empty, Tag, Btn, inputCls } from "@/components/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { disputeReplyAction } from "@/lib/actions/shop";
import MonitorNotice from "@/components/MonitorNotice";
import LocalTime from "@/components/LocalTime";

type D = {
  id: string; code: string; order_id: string; amount: number; reason: string;
  status: string; resolution: string | null; created_at: string; store_name: string;
};
type M = { id: string; dispute_id: string; sender: string; body: string; created_at: string };

export default function DisputesView({ disputes, messages }: { disputes: D[]; messages: M[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(disputes[0]?.code ?? null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  if (!disputes.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Disputes</h1>
        <Empty
          title="No disputes"
          sub="If an order goes wrong, open a dispute from the order page and our team steps in."
          action={<Link href="/dashboard/orders"><Btn variant="ghost">Go to orders</Btn></Link>}
        />
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Disputes</h1>
      <div className="space-y-3">
        {disputes.map((d) => {
          const expanded = open === d.code;
          const thread = messages.filter((m) => m.dispute_id === d.id);
          return (
            <div key={d.code} className="rounded-2xl panel p-4">
              <button
                onClick={() => setOpen(expanded ? null : d.code)}
                className="flex w-full flex-wrap items-center gap-3 text-left"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-400">
                  <Gavel size={15} />
                </span>
                <div className="min-w-[160px] flex-1">
                  <div className="line-clamp-1 text-[12.5px] font-bold">{d.reason}</div>
                  <div className="text-[11px] muted">
                    {d.code} · {d.store_name} · <LocalTime at={d.created_at} />
                  </div>
                </div>
                <Tag tone={statusTone(d.status)}>{label(d.status)}</Tag>
                <div className="text-[14px] font-black">{money(d.amount)}</div>
              </button>

              {expanded && (
                <div className="mt-4 border-t border-[var(--line)] pt-3">
                  {d.resolution && (
                    <div className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-400">
                      Resolution: {d.resolution}
                    </div>
                  )}
                  <div className="space-y-2">
                    {thread.length === 0 && (
                      <div className="text-[11.5px] muted">No replies yet — support has been notified.</div>
                    )}
                    {thread.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-[12px] ${
                          m.sender === "buyer" ? "ml-auto bg-brand-600 text-white" : "soft"
                        }`}
                      >
                        <div className="mb-0.5 text-[10px] capitalize opacity-70">
                          {m.sender} · <TimeAgo at={m.created_at} />
                        </div>
                        {m.body}
                      </div>
                    ))}
                  </div>

                  {!["resolved", "rejected"].includes(d.status) && (
                    <>
                    <div className="mt-3"><MonitorNotice /></div>
                    <div className="mt-2 flex gap-2">
                      <input
                        className={inputCls}
                        placeholder="Add more information…"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                      />
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
