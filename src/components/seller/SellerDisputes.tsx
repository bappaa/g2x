"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Gavel, Send, Loader2, Paperclip, X, AlertCircle, CheckCircle2, FileWarning,
} from "lucide-react";
import { Btn, Empty, Tag, inputCls } from "@/components/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { disputeMessageAction } from "@/lib/actions/shop";
import MonitorNotice from "@/components/MonitorNotice";
import LocalTime from "@/components/LocalTime";
import TimeAgo from "@/components/TimeAgo";

type D = {
  id: string; code: string; amount: number; reason: string; status: string;
  resolution: string | null; created_at: string; buyer_name: string;
};
type M = {
  id: string; dispute_id: string; sender: string; body: string; created_at: string;
  kind?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  attachment_data?: string | null;
  purged?: number | null;
};

const CLOSED = ["resolved", "rejected"];
const fileSize = (n?: number | null) =>
  !n ? "" : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/** One dispute = one conversation. Kept self-contained so each has its own composer state. */
function DisputeThread({ d, thread }: { d: D; thread: M[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [lightbox, setLightbox] = useState<M | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const closed = CLOSED.includes(d.status);

  const submit = () => {
    if (busy.current) return;
    if (!text.trim() && !file) {
      setErr("Write a message or attach evidence.");
      return;
    }
    busy.current = true;
    setErr("");
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("body", text.trim());
        if (file) fd.set("file", file);
        const r = await disputeMessageAction(d.code, fd);
        if (!r.ok) {
          setErr(r.error || "Could not send.");
          return;
        }
        setText("");
        setFile(null);
        if (picker.current) picker.current.value = "";
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <div className="rounded-2xl panel p-4">
      {/* header */}
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

      {/* The dispute itself, highlighted exactly like the buyer's chat banner. */}
      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-3">
        <AlertCircle size={16} className="mt-px shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-rose-300">Order disputed by buyer</div>
          <div className="mt-0.5 break-words text-[12px] text-rose-200/90">Reason: {d.reason}</div>
        </div>
        <div className="shrink-0 text-[10.5px] text-rose-300/80">
          <LocalTime at={d.created_at} />
        </div>
      </div>

      {closed && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
          <div className="text-[12px] font-semibold text-emerald-300">
            Dispute {label(d.status).toLowerCase()}
            {d.resolution ? ` — ${d.resolution}` : ""}
          </div>
        </div>
      )}

      {/* conversation */}
      <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
        {thread.map((m) => {
          const mine = m.sender === "seller";
          const isImage = m.kind === "image";
          const isVideo = m.kind === "video";
          const expired = !!m.purged || ((isImage || isVideo) && !m.attachment_data);

          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-xl px-3 py-2 text-[12px] ${
                mine ? "ml-auto bg-brand-600 text-white" : "soft"
              }`}
            >
              <div className="mb-0.5 text-[10px] capitalize opacity-70">
                {m.sender} · <TimeAgo at={m.created_at} />
              </div>

              {expired && (isImage || isVideo) ? (
                <div className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2 text-[11px] opacity-80">
                  <FileWarning size={13} className="shrink-0" />
                  Attachment expired (kept 10 days)
                </div>
              ) : isImage ? (
                <button type="button" onClick={() => setLightbox(m)} className="block">
                  {/* Data URI from our own DB; next/image cannot optimise it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.attachment_data ?? ""}
                    alt={m.attachment_name ?? "evidence"}
                    className="max-h-[220px] rounded-lg object-cover"
                  />
                  <span className="mt-1 block text-[10px] opacity-70">
                    {m.attachment_name} · {fileSize(m.attachment_size)}
                  </span>
                </button>
              ) : isVideo ? (
                <div>
                  <video
                    src={m.attachment_data ?? ""}
                    controls
                    preload="metadata"
                    className="max-h-[240px] w-full rounded-lg"
                  />
                  <span className="mt-1 block text-[10px] opacity-70">
                    {m.attachment_name} · {fileSize(m.attachment_size)}
                  </span>
                </div>
              ) : (
                <span className="whitespace-pre-wrap break-words">{m.body}</span>
              )}
            </div>
          );
        })}

        {!closed && (
          <>
            <div className="pt-1">
              <MonitorNotice />
            </div>

            {file && (
              <div className="flex items-center gap-2 rounded-lg soft px-3 py-2 text-[11.5px]">
                <Paperclip size={13} className="shrink-0 muted" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 muted">{fileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (picker.current) picker.current.value = "";
                  }}
                  aria-label="Remove attachment"
                  className="shrink-0 rounded p-0.5 transition-colors hover:text-rose-400"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {err && <div className="text-[11.5px] text-rose-400">{err}</div>}

            <div className="flex gap-2 pt-1">
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 8 * 1024 * 1024) {
                    setErr("Evidence must be 8 MB or smaller.");
                    e.target.value = "";
                    return;
                  }
                  setErr("");
                  setFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => picker.current?.click()}
                title="Attach image or video evidence"
                aria-label="Attach evidence"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg soft transition-colors hover:bg-brand-600/10 hover:text-brand-500"
              >
                <Paperclip size={15} />
              </button>
              <input
                className={inputCls}
                placeholder="Respond with evidence…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Btn disabled={pending} onClick={submit}>
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </Btn>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.attachment_data ?? ""}
              alt={lightbox.attachment_name ?? "evidence"}
              className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain"
            />
            <button
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SellerDisputes({ disputes, messages }: { disputes: D[]; messages: M[] }) {
  if (!disputes.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black tracking-tight sm:text-[22px]">Disputes</h1>
        <Empty title="No disputes" sub="Great — buyers are happy with your deliveries." />
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black tracking-tight sm:text-[22px]">Disputes</h1>
      <p className="text-[12px] muted">
        Evidence you attach here is kept for 10 days after the dispute closes, then removed
        automatically.
      </p>
      {disputes.map((d) => (
        <DisputeThread
          key={d.code}
          d={d}
          thread={messages.filter((m) => m.dispute_id === d.id)}
        />
      ))}
    </div>
  );
}
