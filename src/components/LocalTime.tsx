"use client";
import { useEffect, useState } from "react";
import { when, day } from "@/lib/fmt";

/**
 * TIMEZONE-CORRECT TIMESTAMP
 * ==========================
 * All timestamps are stored in UTC. They used to be *rendered* in UTC too
 * (`fmt.ts` pins `timeZone: "UTC"`), which meant a buyer in India saw a
 * wallet top-up made at 3:00 PM IST labelled "09:30 AM" — a 5h30m error, and
 * the same problem in every other non-UTC timezone.
 *
 * The UTC pin exists for a real reason: server and client must produce
 * byte-identical HTML or React aborts hydration. So we cannot simply format in
 * local time during SSR — the server has no idea what the visitor's zone is.
 *
 * The fix is two-phase, the same trick `TimeAgo` uses:
 *   1. Server render + first client pass → the pinned UTC string (identical,
 *      so hydration succeeds).
 *   2. After hydration, an effect re-formats using the browser's actual
 *      timezone and the component swaps in the correct local time.
 *
 * `suppressHydrationWarning` covers the intentional swap, and the `<time>`
 * element keeps the machine-readable UTC value for accessibility and SEO.
 */

/** Formats in the viewer's own timezone. Only ever called in the browser. */
function localFormat(iso: string, mode: "datetime" | "date"): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;

  const opts: Intl.DateTimeFormatOptions =
    mode === "date"
      ? { day: "2-digit", month: "short", year: "numeric" }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        };

  // No timeZone key → the runtime uses the visitor's own zone.
  return d.toLocaleString(undefined, opts);
}

export default function LocalTime({
  at,
  mode = "datetime",
  className,
}: {
  at: string;
  /** `datetime` includes the clock time; `date` is the calendar day only. */
  mode?: "datetime" | "date";
  className?: string;
}) {
  // Phase 1: the pinned UTC string, matching what the server rendered.
  const [text, setText] = useState(() => (mode === "date" ? day(at) : when(at)));

  // Phase 2: re-format in the visitor's timezone once we are in the browser.
  useEffect(() => {
    setText(localFormat(at, mode));
  }, [at, mode]);

  return (
    <time dateTime={at} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
