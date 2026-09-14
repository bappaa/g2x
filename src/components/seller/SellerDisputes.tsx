"use client";
import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel, Send, Loader2, Paperclip, X, AlertCircle, CheckCircle2, FileWarning, ChevronLeft,
} from "lucide-react";
import { Btn, Empty, Tag, inputCls } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { disputeMessageAction } from "@/lib/actions/shop";
import MonitorNotice from "@/components/MonitorNotice";
import LocalTime from "@/components/LocalTime";
import TimeAgo from "@/components/TimeAgo";
import { useMoney } from "@/components/LocaleProvider";

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

function DisputeChat({ d, thread }: { d: D; thread: M[] }) {
  const money = useMoney();
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [lightbox, setLightbox] = useState<M | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const closed = CLOSED.includes(d.status);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--line)] p-3">
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

      <div className="shrink-0 p-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-3">
          <AlertCircle size={16} className="mt-px shrink-0 text-rose-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold text-rose-300">Order disputed by buyer</div>
            <div className="mt-0.5 break-words text-[12px] text-rose-200/90">Reason: {d.reason}</div>
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
      </div>

      <div className="shrink-0 px-3">
        <MonitorNotice />
      </div>

      {/* Messages scroll */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.attachment_data ?? ""} alt={m.attachment_name ?? "evidence"} className="max-h-[220px] rounded-lg object-cover" />
                  <span className="mt-1 block text-[10px] opacity-70">
                    {m.attachment_name} · {fileSize(m.attachment_size)}
                  </span>
                </button>
              ) : isVideo ? (
                <div>
                  <video src={m.attachment_data ?? ""} controls preload="metadata" className="max-h-[240px] w-full rounded-lg" />
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
        <div ref={endRef} />
      </div>

      {!closed && (
        <div className="shrink-0 border-t border-[var(--line)] p-3">
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-lg soft px-3 py-2 text-[11.5px]">
              <Paperclip size={13} className="shrink-0 muted" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 muted">{fileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (picker.current) picker.current.value = "";
                }}
                className="shrink-0 rounded p-0.5 hover:text-rose-400"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {err && <div className="mb-2 text-[11.5px] text-rose-400">{err}</div>}
          <div className="flex gap-2">
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
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg soft hover:bg-brand-600/10 hover:text-brand-500"
            >
              <Paperclip size={15} />
            </button>
            <input
              className={inputCls}
              placeholder="Respond with evidence..."
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
        </div>
      )}

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
            <img src={lightbox.attachment_data ?? ""} alt={lightbox.attachment_name ?? "evidence"} className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain" />
            <button type="button" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SellerDisputes({
  disputes,
  messages,
  activeCode,
}: {
  disputes: D[];
  messages: M[];
  activeCode?: string | null;
}) {
  const router = useRouter();
  const money = useMoney();

  const activeDispute = activeCode
    ? disputes.find((d) => d.code === activeCode) || disputes[0]
    : disputes[0];

  const activeThread = activeDispute ? messages.filter((m) => m.dispute_id === activeDispute.id) : [];

  if (!disputes.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black tracking-tight sm:text-[22px]">Disputes</h1>
        <Empty title="No disputes" sub="Great — buyers are happy with your deliveries." />
      </div>
    );
  }

  const showListOnMobile = !activeCode;

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[460px] flex-col gap-3 sm:h-[calc(100dvh-150px)]">
      <div className="flex shrink-0 items-center gap-2">
        {activeCode && (
          <button
            onClick={() => router.push("/seller/disputes")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] md:hidden"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h1 className="truncate text-[18px] font-black tracking-tight sm:text-[22px]">
          {activeCode ? activeDispute?.reason ?? "Dispute" : "Disputes"}
        </h1>
        {!activeCode && (
          <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
            {disputes.length} total
          </span>
        )}
      </div>

      <p className={`shrink-0 text-[12px] muted ${activeCode ? "hidden md:block" : "block"}`}>
        Evidence you attach here is kept for 10 days after the dispute closes, then removed automatically.
      </p>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl panel md:grid-cols-[300px_minmax(0,1fr)]">
        {/* List */}
        <div className={`min-h-0 overflow-y-auto border-[var(--line)] md:block md:border-r ${showListOnMobile ? "block" : "hidden"}`}>
          {disputes.map((d) => (
            <button
              key={d.code}
              onClick={() => router.push(`/seller/disputes?d=${d.code}`)}
              className={`flex w-full items-center gap-2.5 border-b border-[var(--line)] p-3 text-left transition-colors last:border-0 ${
                d.code === activeDispute?.code ? "bg-brand-600/10" : "hover:bg-brand-600/[.05]"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-400">
                <Gavel size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12px] font-bold">{d.reason}</div>
                <div className="line-clamp-1 text-[10.5px] muted">
                  {d.code} · {d.buyer_name}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Tag tone={statusTone(d.status)}>{label(d.status)}</Tag>
                  <span className="text-[10px] muted"><TimeAgo at={d.created_at} /></span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] font-black">{money(d.amount)}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Chat */}
        <div className={`min-h-0 min-w-0 flex-col md:flex ${showListOnMobile ? "hidden" : "flex"}`}>
          {activeDispute ? (
            <DisputeChat d={activeDispute} thread={activeThread} />
          ) : (
            <div className="hidden flex-1 place-items-center p-6 text-center text-[12.5px] muted md:grid">
              <div>
                <Gavel size={22} className="mx-auto mb-2 text-brand-400" />
                Select a dispute to view and respond.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


