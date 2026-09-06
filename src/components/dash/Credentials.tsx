"use client";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, ShieldCheck, CopyCheck } from "lucide-react";
import { parseCreds, copyText, credsToText } from "@/lib/creds";

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

  return (
    <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[.07] p-3">
      <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold text-emerald-400">
        <ShieldCheck size={13} /> Delivered details
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="ml-auto flex items-center gap-1 muted transition-colors hover:text-brand-400"
        >
          {show ? <EyeOff size={12} /> : <Eye size={12} />} {show ? "Hide" : "Reveal"}
        </button>
        <button
          type="button"
          onClick={() => copy(credsToText(creds), id + "__all")}
          title="Copy everything"
          className="flex items-center gap-1 muted transition-colors hover:text-brand-400"
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

      <div className="space-y-1.5">
        {creds.map((c, i) => {
          const key = id + "_" + i;
          return (
            <div key={key} className="flex items-center gap-2 text-[12px]">
              <span className="w-[110px] shrink-0 capitalize muted">{c.label}</span>
              <code className="min-w-0 flex-1 truncate font-mono">
                {show ? c.value : "•".repeat(Math.min(18, c.value.length))}
              </code>
              <button
                type="button"
                onClick={() => copy(c.value, key)}
                title={`Copy ${c.label}`}
                className="shrink-0 muted transition-colors hover:text-brand-400"
              >
                {copied === key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
