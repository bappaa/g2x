"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { CategoryIcon } from "./CategoryIcon";

export type StatItem = {
  key: string; icon: string; value: string; label: string;
  n?: number; suffix?: string;
};

function Counter({ n, suffix }: { n: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1200, 1);
      setV(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, n]);
  return (
    <span ref={ref}>
      {v.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

/**
 * Trust bar. Values are either real live counts from the database or
 * admin-written copy from the `trust` CMS block. Nothing is hardcoded.
 */
export default function Stats({ items }: { items: StatItem[] }) {
  if (!items.length) return null;

  return (
    <section className="mx-auto max-w-[1220px] px-3 sm:px-4">
      <div
        className="grid gap-x-4 gap-y-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-5 sm:px-6 sm:py-6"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))" }}
      >
        {items.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i * 0.06, 0.4) }}
            className="group flex items-center gap-2.5"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600/12 transition-transform duration-300 group-hover:scale-110">
              <CategoryIcon name={s.icon} slug={s.key} size={16} color="var(--brand,#8b3dff)" />
            </div>
            <div className="leading-tight">
              <div className="text-[12.5px] font-bold sm:text-[13px]">
                {typeof s.n === "number" ? <Counter n={s.n} suffix={s.suffix ?? ""} /> : s.value}
              </div>
              <div className="mt-0.5 text-[10.5px] leading-tight muted">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
