"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search, ShieldAlert, Check, Ban, AlertTriangle, Loader2, Store, User as UserIcon, Flag,
} from "lucide-react";
import { Tag, Empty, inputCls } from "@/components/ui";

import { reviewMessageAction } from "@/lib/actions/admin";
import LocalTime from "@/components/LocalTime";

type T = {
  id: string; order_id: string | null; updated_at: string;
  buyer_name: string; buyer_email: string; buyer_id: string;
  seller_name: string; store_name: string | null; seller_id: string;
  msg_count: number; flag_count: number; last_body: string;
};
type M = {
  id: string; thread_id: string; sender_id: string; sender_name: string; sender_role: string;
  body: string; flagged: number; flag_reasons: string | null; admin_reviewed: number; created_at: string;
};
type F = M & { sender_email: string };

const REASON: Record<string, string> = {
  email: "Email address",
  phone: "Phone number",
  social: "Social / messenger handle",
  external_url: "External link",
  offsite_payment: "Off-platform payment",
  evade: "Commission evasion",
  no_fee: "Avoiding fees",
};

export default function ChatMonitor({
  threads, messages, flagged, activeId, view, q,
}: {
  threads: T[]; messages: M[]; flagged: F[]; activeId: string; view: string; q: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const [tab, setTab] = useState<"threads" | "queue">("threads");

  const go = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ view, ...(q ? { q } : {}), ...params });
    router.push(`/admin/messages?${sp.toString()}`);
  };

  const active = threads.find((t) => t.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(["flagged", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => router.push(`/admin/messages?view=${v}`)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
                view === v ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
              }`}
            >
              {v === "flagged" ? "Flagged chats" : "All chats"}
            </button>
          ))}
        </div>
        <form
          className="relative min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/admin/messages?view=${view}&q=${encodeURIComponent(term)}`);
          }}
        >
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="Search by buyer email or store…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </form>
        <div className="flex gap-1.5 lg:hidden">
          {(["threads", "queue"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-[12px] capitalize ${tab === t ? "bg-brand-600 text-white" : "soft muted"}`}
            >
              {t === "queue" ? `Queue (${flagged.filter((f) => !f.admin_reviewed).length})` : "Chats"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[260px_1fr_280px]">
        {/* thread list */}
        <div className={`space-y-1.5 lg:block ${tab === "threads" ? "" : "hidden"}`}>
          {threads.length === 0 && <Empty title="No chats" sub="Nothing matches this filter." />}
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => go({ thread: t.id })}
              className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                t.id === activeId
                  ? "border-brand-500/50 bg-brand-600/10"
                  : "border-[var(--line)] panel hover:border-brand-500/30"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="line-clamp-1 flex-1 text-[12px] font-bold">{t.buyer_name}</span>
                {t.flag_count > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">
                    {t.flag_count}
                  </span>
                )}
              </div>
              <div className="line-clamp-1 text-[10.5px] muted">↔ {t.store_name || t.seller_name}</div>
              <div className="line-clamp-1 pt-0.5 text-[10.5px] muted">{t.last_body}</div>
              <div className="pt-0.5 text-[9.5px] muted">{t.msg_count} msgs · <LocalTime at={t.updated_at} /></div>
            </button>
          ))}
        </div>

        {/* transcript */}
        <div className={`rounded-2xl panel p-4 lg:block ${tab === "threads" ? "" : "hidden"}`}>
          {!active ? (
            <Empty title="Select a conversation" sub="Pick a chat on the left to read the full transcript." />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-1.5 text-[12px] font-bold">
                  <UserIcon size={12} className="text-brand-400" /> {active.buyer_name}
                </div>
                <span className="muted">↔</span>
                <div className="flex items-center gap-1.5 text-[12px] font-bold">
                  <Store size={12} className="text-emerald-400" /> {active.store_name || active.seller_name}
                </div>
                {active.order_id && <Tag tone="slate">Order attached</Tag>}
                {active.flag_count > 0 && <Tag tone="red">{active.flag_count} flagged</Tag>}
              </div>

              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {messages.map((m, i) => {
                  const seller = m.sender_id === active.seller_id;
                  const reasons = safe(m.flag_reasons);
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className={`flex ${seller ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[78%]">
                        <div className="mb-0.5 flex items-center gap-1.5 text-[9.5px] muted">
                          {seller ? "Seller" : "Buyer"} · {m.sender_name} · <LocalTime at={m.created_at} />
                        </div>
                        <div
                          className={`rounded-xl px-3 py-2 text-[12px] ${
                            m.flagged
                              ? "border border-rose-500/40 bg-rose-500/10"
                              : seller
                              ? "bg-brand-600 text-white"
                              : "soft"
                          }`}
                        >
                          {m.body}
                        </div>
                        {reasons.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Flag size={9} className="text-rose-400" />
                            {reasons.map((r) => (
                              <span key={r} className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] text-rose-400">
                                {REASON[r] ?? r}
                              </span>
                            ))}
                            <MsgActions id={m.id} reviewed={!!m.admin_reviewed} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* review queue */}
        <div className={`space-y-2 lg:block ${tab === "queue" ? "" : "hidden"}`}>
          <div className="flex items-center gap-1.5 text-[12px] font-bold">
            <ShieldAlert size={13} className="text-rose-400" /> Review queue
          </div>
          {flagged.length === 0 && (
            <div className="rounded-xl panel p-4 text-center text-[11.5px] muted">
              No flagged messages. Sellers are behaving.
            </div>
          )}
          {flagged.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border p-2.5 ${
                f.admin_reviewed ? "border-[var(--line)] panel opacity-60" : "border-rose-500/35 bg-rose-500/[.06]"
              }`}
            >
              <button onClick={() => go({ thread: f.thread_id })} className="w-full text-left">
                <div className="text-[11px] font-bold">{f.sender_name}</div>
                <div className="text-[9.5px] muted">{f.sender_email} · <LocalTime at={f.created_at} /></div>
                <div className="mt-1 line-clamp-2 text-[11px]">{f.body}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {safe(f.flag_reasons).map((r) => (
                    <span key={r} className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] text-rose-400">
                      {REASON[r] ?? r}
                    </span>
                  ))}
                </div>
              </button>
              <div className="mt-1.5">
                <MsgActions id={f.id} reviewed={!!f.admin_reviewed} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MsgActions({ id, reviewed }: { id: string; reviewed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (a: "clear" | "warn" | "ban") => {
    if (a === "ban" && !confirm("Suspend this account, log them out and pause all their offers?")) return;
    start(async () => {
      await reviewMessageAction(id, a);
      router.refresh();
    });
  };

  if (reviewed) return <span className="text-[9.5px] text-emerald-400">✓ Reviewed</span>;

  return (
    <div className="flex items-center gap-1">
      {pending && <Loader2 size={10} className="animate-spin muted" />}
      <button onClick={() => act("clear")} disabled={pending} title="False positive"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] soft hover:text-emerald-400">
        <Check size={9} /> Clear
      </button>
      <button onClick={() => act("warn")} disabled={pending} title="Send a policy warning"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] soft hover:text-amber-400">
        <AlertTriangle size={9} /> Warn
      </button>
      <button onClick={() => act("ban")} disabled={pending} title="Suspend the account"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] soft hover:text-rose-400">
        <Ban size={9} /> Ban
      </button>
    </div>
  );
}

function safe(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
