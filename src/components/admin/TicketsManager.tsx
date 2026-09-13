"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Ticket } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { ticketReplyAction } from "@/lib/actions/admin";
import LocalTime from "@/components/LocalTime";

type T = {
  id: string; code: string; subject: string; category: string; status: string;
  name: string; email: string; first_msg: string; created_at: string;
};

export default function TicketsManager({ rows }: { rows: T[] }) {
  const [open, setOpen] = useState<string | null>(rows[0]?.code ?? null);

  if (!rows.length) return <Empty title="No tickets" sub="Nothing matches this filter." />;

  return (
    <div className="space-y-2.5">
      {rows.map((t) => (
        <div key={t.id} className="rounded-2xl panel p-4">
          <button
            onClick={() => setOpen(open === t.code ? null : t.code)}
            className="flex w-full flex-wrap items-center gap-2 text-left"
          >
            <Ticket size={13} className="text-brand-400" />
            <span className="font-mono text-[11px] font-bold">{t.code}</span>
            <span className="text-[13px] font-semibold">{t.subject}</span>
            <Tag tone={statusTone(t.status)}>{label(t.status)}</Tag>
            <span className="ml-auto text-[10.5px] muted">{t.name} · <LocalTime at={t.created_at} /></span>
          </button>
          <p className="mt-1.5 line-clamp-2 text-[11.5px] muted">{t.first_msg}</p>
          {open === t.code && <Reply code={t.code} status={t.status} />}
        </div>
      ))}
    </div>
  );
}

function Reply({ code, status }: { code: string; status: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [next, setNext] = useState(status);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
      <Field label="Reply to the customer">
        <textarea rows={3} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-[160px]">
          <Field label="Set status">
            <select className={inputCls} value={next} onChange={(e) => setNext(e.target.value)}>
              {["open", "pending", "resolved", "closed"].map((s) => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>
          </Field>
        </div>
        <Btn
          className="flex items-center gap-2"
          disabled={pending || (!body.trim() && next === status)}
          onClick={() =>
            start(async () => {
              await ticketReplyAction(code, body, next);
              setBody("");
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
        </Btn>
      </div>
    </div>
  );
}
