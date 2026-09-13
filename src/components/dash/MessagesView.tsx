"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Send, Loader2, MessagesSquare, ChevronLeft, ImagePlus, AlertCircle, Gavel, X, CheckCircle2,
} from "lucide-react";
import { Empty, inputCls } from "@/components/ui";
import MonitorNotice from "@/components/MonitorNotice";
import {
  sendMessageAction, markThreadReadAction, sendAttachmentAction,
  openDisputeInChatAction, resolveDisputeInChatAction,
} from "@/lib/actions/shop";
import LocalTime from "@/components/LocalTime";

type T = {
  id: string; other_name: string; last_body: string | null; unread: number;
  updated_at: string; order_code?: string;
  /** Set while a dispute is open on this conversation. */
  dispute_id?: string | null;
};
type M = {
  id: string; thread_id: string; sender_id: string; body: string; created_at: string;
  /** `text` | `image` | `dispute` | `dispute_resolved` */
  kind?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  attachment_data?: string | null;
  dispute_id?: string | null;
};

/** Human-readable file size for the attachment bubble. */
function fileSize(bytes?: number | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessagesView({
  me, threads, activeId, messages, isSeller = false,
}: {
  me: string; threads: T[]; activeId: string | null; messages: M[];
  /** Sellers can read a dispute but only the buyer can open or close one. */
  isSeller?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [warn, setWarn] = useState("");

  useEffect(() => {
    if (activeId) markThreadReadAction(activeId);
  }, [activeId]);

  /**
   * Near-real-time chat without a websocket server.
   *
   * The thread is a server component, so `router.refresh()` re-fetches it and
   * React reconciles only what changed (no scroll jump, no flicker). We poll
   * every 5s while the tab is visible, pause when it is hidden to save
   * requests, and refresh immediately on focus so switching back is instant.
   */
  useEffect(() => {
    if (!activeId) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const startPoll = () => {
      if (timer) return;
      timer = setInterval(tick, 5000);
    };
    const stopPoll = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        startPoll();
      } else stopPoll();
    };

    startPoll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopPoll();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [activeId, router]);

  // Keep the newest message in view as the thread grows.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  /* ---------------- attachments & disputes ---------------- */
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [busyDispute, startDispute] = useTransition();
  const [preview, setPreview] = useState<M | null>(null);

  /** Is there an unresolved dispute in this conversation right now? */
  const openDispute = (() => {
    let live: M | null = null;
    for (const m of messages) {
      if (m.kind === "dispute") live = m;
      if (m.kind === "dispute_resolved") live = null;
    }
    return live;
  })();

  const pickImage = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !activeId) return;

    if (file.size > 2 * 1024 * 1024) return setWarn("Images must be 2 MB or smaller.");
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type))
      return setWarn("Only PNG, JPEG, WEBP or GIF images are allowed.");

    setWarn("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await sendAttachmentAction(activeId, fd);
      if (!r.ok) setWarn(r.error || "Could not send that image.");
      else router.refresh();
    } finally {
      setUploading(false);
    }
  };

  const raiseDispute = () => {
    if (!activeId) return;
    startDispute(async () => {
      const r = await openDisputeInChatAction(activeId, disputeText);
      if (!r.ok) return setWarn(r.error || "Could not open the dispute.");
      setShowDispute(false);
      setDisputeText("");
      setWarn("");
      router.refresh();
    });
  };

  const closeDispute = () => {
    if (!activeId) return;
    startDispute(async () => {
      const r = await resolveDisputeInChatAction(activeId);
      if (!r.ok) return setWarn(r.error || "Could not close the dispute.");
      setWarn("");
      router.refresh();
    });
  };

  if (!threads.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Messages</h1>
        <Empty title="No conversations yet" sub="Start a chat from any order page to reach the seller." />
      </div>
    );

  const active = threads.find((t) => t.id === activeId);

  /** One code path for the send button and the Enter key. */
  const send = () => {
    const body = text.trim();
    if (!body || !activeId || pending) return;
    start(async () => {
      const r = await sendMessageAction(activeId, body);
      setWarn(r.warning ?? "");
      setText("");
      router.refresh();
    });
  };

  /**
   * MOBILE PATTERN
   * On a phone there is not enough width for a sidebar plus a conversation, so
   * the two become separate screens: the thread list, then the conversation
   * with a back button. `activeId` decides which one is visible. From `md` up
   * both panes show side by side as usual.
   */
  const showListOnMobile = !activeId;

  return (
    /**
     * The chat fills the viewport instead of floating in a short box. The panel
     * is a flex column pinned to a viewport-derived height, so the message list
     * is the only thing that scrolls while the header and composer stay put.
     * `100dvh` tracks mobile browser chrome as it hides and shows.
     */
    <div className="flex h-[calc(100dvh-140px)] min-h-[460px] flex-col gap-3 sm:h-[calc(100dvh-150px)]">
      <div className="flex shrink-0 items-center gap-2">
        {activeId && (
          <button
            onClick={() => router.push("/dashboard/messages")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] md:hidden"
            aria-label="Back to conversations"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h1 className="truncate text-[18px] font-black tracking-tight sm:text-[22px]">
          {activeId ? active?.other_name ?? "Messages" : "Messages"}
        </h1>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl panel md:grid-cols-[260px_minmax(0,1fr)]">
        {/* Conversation list */}
        <div
          className={`min-h-0 overflow-y-auto border-[var(--line)] md:block md:border-r ${
            showListOnMobile ? "block" : "hidden"
          }`}
        >
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/dashboard/messages?t=${t.id}`)}
              className={`flex w-full items-center gap-2.5 border-b border-[var(--line)] p-3 text-left transition-colors last:border-0 ${
                t.id === activeId ? "bg-brand-600/10" : "hover:bg-brand-600/[.05]"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[12px] font-bold text-white">
                {(t.other_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12.5px] font-bold">{t.other_name}</div>
                <div className="line-clamp-1 text-[10.5px] muted">{t.last_body ?? "No messages yet"}</div>
                {t.dispute_id && (
                  <span className="mt-1 inline-block rounded bg-rose-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                    Disputed
                  </span>
                )}
              </div>
              {t.unread > 0 && (
                <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[9.5px] font-bold text-white">
                  {t.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conversation */}
        <div
          className={`min-h-0 min-w-0 flex-col md:flex ${showListOnMobile ? "hidden" : "flex"}`}
        >
          {!activeId ? (
            <div className="hidden flex-1 place-items-center p-6 text-center text-[12.5px] muted md:grid">
              <div>
                <MessagesSquare size={22} className="mx-auto mb-2 text-brand-400" />
                Pick a conversation to start reading.
              </div>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] p-3 text-[12.5px] font-bold">
                <MessagesSquare size={14} className="shrink-0 text-brand-400" />
                <span className="truncate">{active?.other_name}</span>
                {active?.order_code && (
                  <span className="shrink-0 text-[10.5px] font-normal muted">· {active.order_code}</span>
                )}
              </div>

              <div className="shrink-0 px-3 pt-3">
                <MonitorNotice />
              </div>

              {/* The only scrolling region. */}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {messages.length === 0 && (
                  <div className="py-8 text-center text-[12px] muted">Say hello 👋</div>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === me;

                  /* Dispute opened — full-width red alert, not a chat bubble. */
                  if (m.kind === "dispute")
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border-2 border-rose-500/70 bg-rose-500/10 px-3 py-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertCircle size={17} className="mt-px shrink-0 text-rose-400" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <span className="text-[12.5px] font-bold text-rose-300">
                                Order disputed by buyer
                              </span>
                              <span className="ml-auto shrink-0 text-[10px] muted">
                                <LocalTime at={m.created_at} />
                              </span>
                            </div>
                            <div className="mt-0.5 break-words text-[11.5px] text-rose-200/90">
                              Reason: {m.body}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );

                  /* Dispute withdrawn by the buyer. */
                  if (m.kind === "dispute_resolved")
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                          <span className="text-[12px] font-semibold text-emerald-300">
                            Dispute closed by the buyer
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] muted">
                            <LocalTime at={m.created_at} />
                          </span>
                        </div>
                      </motion.div>
                    );

                  /* Image attachment. */
                  if (m.kind === "image" && m.attachment_data)
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`w-fit max-w-[85%] overflow-hidden rounded-xl sm:max-w-[60%] ${
                          mine ? "ml-auto bg-brand-600" : "soft"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setPreview(m)}
                          className="block w-full"
                          title="Open full size"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.attachment_data}
                            alt={m.attachment_name ?? "attachment"}
                            className="max-h-[260px] w-full object-cover"
                          />
                        </button>
                        <div
                          className={`px-2.5 py-1.5 text-[10px] ${
                            mine ? "text-white/85" : "muted"
                          }`}
                        >
                          <div className="truncate">{m.attachment_name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span>{fileSize(m.attachment_size)}</span>
                            <span aria-hidden>·</span>
                            <LocalTime at={m.created_at} />
                          </div>
                        </div>
                      </motion.div>
                    );

                  /* Ordinary text message. */
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`w-fit max-w-[85%] break-words rounded-xl px-3 py-2 text-[12px] sm:max-w-[70%] ${
                        mine ? "ml-auto bg-brand-600 text-white" : "soft"
                      }`}
                    >
                      {m.body}
                      <div className="mt-0.5 text-[9.5px] opacity-70">
                        <LocalTime at={m.created_at} />
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {warn && (
                <div className="mx-3 mb-2 shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-400">
                  Flagged for admin review: {warn}. Keep all deals on G2X to stay protected.
                </div>
              )}

              {/* Dispute controls: raising one, or closing an open one. */}
              <div className="shrink-0 px-3">
                {openDispute ? (
                  !isSeller && (
                    <button
                      onClick={closeDispute}
                      disabled={busyDispute}
                      className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11.5px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-60"
                    >
                      {busyDispute ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      Issue resolved — close this dispute
                    </button>
                  )
                ) : isSeller ? null : showDispute ? (
                  <div className="mb-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-2.5">
                    <div className="flex items-center gap-2">
                      <Gavel size={13} className="text-rose-400" />
                      <span className="text-[11.5px] font-bold text-rose-300">Open a dispute</span>
                      <button
                        onClick={() => setShowDispute(false)}
                        className="ml-auto muted transition-colors hover:text-rose-400"
                        aria-label="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className={`${inputCls} mt-2`}
                      placeholder="What went wrong with this order?"
                      value={disputeText}
                      onChange={(e) => setDisputeText(e.target.value)}
                    />
                    <div className="mt-1 text-[10px] muted">
                      {disputeText.trim().length < 10
                        ? `At least ${10 - disputeText.trim().length} more character${
                            10 - disputeText.trim().length === 1 ? "" : "s"
                          }.`
                        : "Ready to submit."}
                    </div>
                    <button
                      onClick={raiseDispute}
                      disabled={busyDispute}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-[11.5px] font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
                    >
                      {busyDispute && <Loader2 size={13} className="animate-spin" />}
                      Submit dispute
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDispute(true)}
                    className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 transition-colors hover:text-rose-300"
                  >
                    <Gavel size={12} /> Open a dispute
                  </button>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] p-3">
                {/* Image attachment — stored in the database, 2 MB cap. */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onFile}
                />
                <button
                  onClick={pickImage}
                  disabled={uploading}
                  aria-label="Attach an image"
                  title="Attach an image (PNG or JPEG, max 2 MB)"
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg border border-[var(--line)] transition-colors hover:bg-[var(--soft)] disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={16} />}
                </button>
                <input
                  className={inputCls}
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  disabled={pending || !text.trim()}
                  onClick={send}
                  aria-label="Send message"
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-brand-600 text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full-size image viewer. */}
      {preview?.attachment_data && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setPreview(null)}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.attachment_data}
            alt={preview.attachment_name ?? "attachment"}
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
