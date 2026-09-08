"use client";
import { useState } from "react";
import {
  Check, Copy, Eye, EyeOff, CheckCircle2, CopyCheck, Info, Package,
} from "lucide-react";
import { parseCreds, copyText, credsToText } from "@/lib/creds";

/**
 * DELIVERED ACCOUNT DETAILS (buyer side)
 *
 * Laid out as a proper "here is what you bought" panel rather than a cramped
 * row of text: a green delivered header, then one labelled row per credential
 * with its own Copy button, matching the approved design.
 *
 * Values stay masked until the buyer presses Reveal. Copy still works while
 * masked — you can hand someone a password without it being shoulder-surfed
 * off the screen.
 *
 * Free-text notes (the seller's "additional details") are rendered as a block
 * instead of a one-line row, because they are usually several sentences.
 */
export default function Credentials({ id, json }: { id: string; json: string | null }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState("");

  const creds = parseCreds(json);
  if (!creds.length) return null;

  const copy = async (v: string, k: string) => {
    const ok = await copyText(v);
    setCopied(ok ? k : "");
    if (ok) setTimeout(() => setCopied(""), 1400);
  };

  // Long values read as notes, not as a copyable field.
  const isNote = (v: string) => v.length > 60 || v.includes("\n");
  const rows = creds.filter((c) => !isNote(c.value));
  const notes = creds.filter((c) => isNote(c.value));

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
      {/* delivered banner */}
      <div className="flex items-center gap-2.5 border-b border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3">
        <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-emerald-400">Account Delivered</div>
          <div className="text-[11px] muted">Your order has been completed successfully.</div>
        </div>
        <span className="shrink-0 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          Completed
        </span>
      </div>

      <div className="p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <Package size={14} className="shrink-0 text-brand-400" />
          <span className="text-[12.5px] font-bold">Account Information</span>

          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="ml-auto flex items-center gap-1 text-[11px] muted transition-colors hover:text-brand-400"
          >
            {show ? <EyeOff size={12} /> : <Eye size={12} />} {show ? "Hide" : "Reveal"}
          </button>
          <button
            type="button"
            onClick={() => copy(credsToText(creds), id + "__all")}
            title="Copy everything"
            className="flex items-center gap-1 text-[11px] muted transition-colors hover:text-brand-400"
          >
            {copied === id + "__all" ? (
              <>
                <CopyCheck size={12} className="text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <CopyCheck size={12} /> Copy all
              </>
            )}
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((c, i) => {
            const key = id + "_" + i;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-[92px] shrink-0 text-[11.5px] font-semibold capitalize muted sm:w-[120px]">
                  {c.label}
                </span>
                <code className="min-w-0 flex-1 truncate rounded-lg border border-[var(--line)] px-3 py-2 font-mono text-[12px] soft">
                  {show ? c.value : "•".repeat(Math.min(18, c.value.length))}
                </code>
                <button
                  type="button"
                  onClick={() => copy(c.value, key)}
                  title={`Copy ${c.label}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-2 text-[11.5px] font-bold text-white transition-colors hover:bg-brand-500"
                >
                  {copied === key ? <Check size={12} /> : <Copy size={12} />}
                  <span className="hidden sm:inline">{copied === key ? "Copied" : "Copy"}</span>
                </button>
              </div>
            );
          })}
        </div>

        {notes.map((c, i) => (
          <div key={"n" + i} className="mt-3">
            <div className="mb-1 text-[11.5px] font-semibold capitalize muted">{c.label}</div>
            <div className="whitespace-pre-wrap rounded-lg border border-[var(--line)] px-3 py-2.5 text-[12px] leading-relaxed soft">
              {show ? c.value : "•".repeat(40)}
            </div>
          </div>
        ))}

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-600/10 px-3 py-2.5">
          <Info size={13} className="mt-px shrink-0 text-brand-400" />
          <span className="text-[11px] leading-relaxed text-brand-200/90">
            Change the email and password as soon as you log in. Keep this order open until you have
            secured the account — you can raise a dispute from here if anything is wrong.
          </span>
        </div>
      </div>
    </div>
  );
}
