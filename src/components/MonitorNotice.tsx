import { ShieldAlert } from "lucide-react";
import { MONITOR_NOTICE } from "@/lib/moderation";

/** Shown above/below every message composer across buyer, seller and dispute chats. */
export default function MonitorNotice({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px] muted">
        <ShieldAlert size={11} className="shrink-0 text-amber-400" />
        <span className="line-clamp-1">{MONITOR_NOTICE}</span>
      </div>
    );

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[.08] px-3 py-2 text-[11px]">
      <ShieldAlert size={13} className="mt-0.5 shrink-0 text-amber-400" />
      <span className="muted">{MONITOR_NOTICE}</span>
    </div>
  );
}
