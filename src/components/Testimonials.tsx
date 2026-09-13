"use client";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { BrandIcon } from "./BrandIcon";
import { useT } from "./LocaleProvider";

export type Review = { id: string; name: string; stars: number; body: string };

const hue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 42%)`;
};

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/**
 * Customer reviews. These are genuine `reviews` rows written by buyers —
 * when there are none yet, the whole section is hidden rather than faked.
 */
export default function Testimonials({
  title, reviews, rating, count,
}: {
  title: string; reviews: Review[]; rating?: string; count?: string;
}) {
  const tr = useT();
  if (!reviews.length) return null;

  return (
    <section className="mx-auto max-w-[1220px] px-3 sm:px-4">
      {title && (
        <div className="mb-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--line)]" />
          <h2 className="text-center text-[12px] font-bold tracking-[0.18em] sm:text-[14px]">{title}</h2>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--line)]" />
        </div>
      )}

      <div
        className="grid gap-2.5 sm:gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))" }}
      >
        {reviews.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i * 0.07, 0.4) }}
            className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/50"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ background: hue(t.name) }}
              >
                {initials(t.name)}
              </div>
              <div className="leading-tight">
                <div className="text-[12.5px] font-semibold">{t.name}</div>
                <div className="text-[10.5px] muted">{tr("home.verifiedBuyer")}</div>
              </div>
            </div>
            <div className="mt-3 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, k) => (
                <Star
                  key={k}
                  size={12}
                  className={k < t.stars ? "fill-amber-400 text-amber-400" : "text-slate-500/40"}
                />
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed muted">{t.body}</p>
          </motion.div>
        ))}
      </div>

      {rating && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[13px]">
          <span className="flex items-center gap-1.5 font-semibold">
            <BrandIcon name="trustpilot" size={17} /> Trustpilot
          </span>
          <span className="font-semibold">Excellent</span>
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, k) => (
              <span key={k} className="grid h-[19px] w-[19px] place-items-center bg-[#00B67A]">
                <Star size={12} className="fill-white text-white" />
              </span>
            ))}
          </span>
          <span className="text-[12px] muted">
            {rating} out of 5{count ? <> based on <u>{count} reviews</u></> : null}
          </span>
        </div>
      )}
    </section>
  );
}
