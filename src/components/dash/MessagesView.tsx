"use client";
import TimeAgo from "@/components/TimeAgo";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, Loader2, MessagesSquare } from "lucide-react";
import { Empty, inputCls } from "@/components/ui";
import MonitorNotice from "@/components/MonitorNotice";
import { when } from "@/lib/fmt";
import { sendMessageAction, markThreadReadAction } from "@/lib/actions/shop";

type T = { id: string; other_name: string; last_body: string | null; unread: number; updated_at: string; order_code?: string };
type M = { id: string; thread_id: string; sender_id: string; body: string; created_at: string };

export default function MessagesView({
  me, threads, activeId, messages,
}: {
  me: string; threads: T[]; activeId: string | null; messages: M[];
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

  if (!threads.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Messages</h1>
        <Empty title="No conversations yet" sub="Start a chat from any order page to reach the seller." />
      </div>
    );

  const active = threads.find((t) => t.id === activeId);

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Messages</h1>
      <div className="grid gap-4 overflow-hidden rounded-2xl panel md:grid-cols-[240px_1fr]">
        <div className="border-[var(--line)] md:border-r">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/dashboard/messages?t=${t.id}`)}
              className={`flex w-full items-center gap-2.5 border-b border-[var(--line)] p-3 text-left last:border-0 transition-colors ${
                t.id === activeId ? "bg-brand-600/10" : "hover:bg-brand-600/[.05]"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[12px] font-bold text-white">
                {(t.other_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12.5px] font-bold">{t.other_name}</div>
                <div className="line-clamp-1 text-[10.5px] muted">{t.last_body ?? "No messages yet"}</div>
              </div>
              {t.unread > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[9.5px] font-bold text-white">{t.unread}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex min-h-[420px] flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--line)] p-3 text-[12.5px] font-bold">
            <MessagesSquare size={14} className="text-brand-400" /> {active?.other_name}
            {active?.order_code && <span className="text-[10.5px] font-normal muted">· {active.order_code}</span>}
          </div>

          <div className="px-3 pt-3">
            <MonitorNotice />
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="py-8 text-center text-[12px] muted">Say hello 👋</div>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === me;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[78%] rounded-xl px-3 py-2 text-[12px] ${
                    mine ? "ml-auto bg-brand-600 text-white" : "soft"
                  }`}
                >
                  {m.body}
                  <div className="mt-0.5 text-[9.5px] opacity-70" title={when(m.created_at)}>
                    <TimeAgo at={m.created_at} />
                  </div>
                </motion.div>
              );
            })}
            <div ref={endRef} />
          </div>

          {warn && (
            <div className="mx-3 mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-400">
              Flagged for admin review: {warn}. Keep all deals on G2X to stay protected.
            </div>
          )}

          <div className="flex gap-2 border-t border-[var(--line)] p-3">
            <input
              className={inputCls}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim() && activeId) {
                  start(async () => {
                    const r = await sendMessageAction(activeId, text);
                    setWarn(r.warning ?? "");
                    setText("");
                    router.refresh();
                  });
                }
              }}
            />
            <button
              disabled={pending || !text.trim() || !activeId}
              onClick={() =>
                activeId &&
                start(async () => {
                  const r = await sendMessageAction(activeId, text);
                  setWarn(r.warning ?? "");
                  setText("");
                  router.refresh();
                })
              }
              className="grid h-[42px] w-[42px] place-items-center rounded-lg bg-brand-600 text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
