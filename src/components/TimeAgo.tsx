"use client";
import { useEffect, useState } from "react";
import { ago } from "@/lib/fmt";

/**
 * Relative timestamp that cannot cause a hydration mismatch.
 *
 * `ago()` reads Date.now(), so the server HTML ("31s ago") and the client's
 * first render ("32s ago") disagree whenever a second ticks over between the
 * two — React then throws "Text content does not match server-rendered HTML".
 *
 * Fix: render the server's string verbatim on the first client pass, then
 * switch to live values in an effect (which runs after hydration). The clock
 * keeps ticking every 30s so the value never goes stale on a long-lived page.
 */
export default function TimeAgo({ at, className }: { at: string; className?: string }) {
  const [text, setText] = useState(() => ago(at));

  useEffect(() => {
    setText(ago(at));
    const id = setInterval(() => setText(ago(at)), 30_000);
    return () => clearInterval(id);
  }, [at]);

  return (
    <time dateTime={at} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
