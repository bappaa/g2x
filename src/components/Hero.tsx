"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";

export type Perk = { icon: string; label: string };

/**
 * Homepage hero. Headline, highlight, copy, perks, buttons and artwork all
 * come from the `hero` CMS block. If the admin deactivates the block, the
 * hero disappears entirely.
 */
export default function Hero({
  title, highlight, body, image, perks, ctaLabel, ctaHref, cta2Label, cta2Href,
  badge, dealLabel, dealPrice, dealWas,
}: {
  title: string; highlight: string; body: string; image: string;
  perks: Perk[]; ctaLabel: string; ctaHref: string;
  cta2Label?: string; cta2Href?: string;
  badge?: string; dealLabel?: string; dealPrice?: string; dealWas?: string;
}) {
  if (!title && !highlight && !body) return null;

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-0 h-[240px] w-[240px] animate-pulseGlow rounded-full bg-brand-600/25 blur-[100px] sm:-left-40 sm:h-[420px] sm:w-[420px] sm:blur-[130px]" />
      <div className="pointer-events-none absolute right-0 top-10 h-[240px] w-[240px] animate-pulseGlow rounded-full bg-fuchsia-600/20 blur-[100px] sm:right-10 sm:h-[420px] sm:w-[420px] sm:blur-[130px]" />

      <div className="mx-auto grid max-w-[1220px] items-center gap-7 px-3 py-7 sm:px-4 md:grid-cols-[1fr_1.05fr] md:gap-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {badge && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-600/15 px-3 py-1.5 text-[10.5px] font-semibold tracking-wide text-brand-300 sm:text-[11.5px]"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
              </span>
              {badge}
            </motion.div>
          )}

          <h1 className="text-balance text-[34px] font-black leading-[1.04] tracking-tight sm:text-[46px] lg:text-[56px]">
            {title}
            {highlight && (
              <>
                <br />
                <span className="grad-text">{highlight}</span>
              </>
            )}
          </h1>

          {body && (
            <p className="mt-4 max-w-[440px] text-[13px] leading-relaxed muted sm:text-[14.5px]">{body}</p>
          )}

          {perks.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {perks.map((p, idx) => (
                <motion.div
                  key={p.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + idx * 0.07 }}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)]/60 px-3 py-1.5 text-[11px] font-medium sm:text-[12px]"
                >
                  <CategoryIcon name={p.icon} slug={p.label} size={13} color="var(--brand,#8b3dff)" />
                  {p.label}
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2.5 sm:gap-3">
            {ctaLabel && (
              <Link
                href={ctaHref || "/"}
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[13px] font-semibold text-white shadow-[0_14px_34px_-12px_rgba(139,61,255,.9)] transition-all hover:-translate-y-0.5 hover:bg-brand-500 sm:flex-none sm:px-7 sm:py-3.5 sm:text-sm"
              >
                {ctaLabel}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            )}
            {cta2Label && (
              <Link
                href={cta2Href || "/p/how-it-works"}
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 px-5 py-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-500 sm:flex-none sm:px-7 sm:py-3.5 sm:text-sm"
              >
                {cta2Label}
              </Link>
            )}
          </div>
        </motion.div>

        {image && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            {/* framed art card, matching the reference layout */}
            <div className="relative overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-950/60 via-[var(--panel)] to-black/40 p-3 shadow-[0_30px_80px_-40px_rgba(139,61,255,.8)] sm:p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(139,61,255,.22),transparent_65%)]" />
              <div className="relative animate-floaty">
                <Image
                  src={image}
                  alt={highlight || title}
                  width={900}
                  height={900}
                  priority
                  unoptimized={image.startsWith("/api/")}
                  sizes="(max-width: 768px) 90vw, 560px"
                  className="mx-auto h-auto w-full max-w-[420px] select-none md:max-w-none"
                />
              </div>

              {dealLabel && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/70 px-3 py-2 backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-auto"
                >
                  <span className="flex items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide text-black">
                    <Sparkles size={9} /> Today&apos;s best deal
                  </span>
                  <span className="truncate text-[11.5px] font-bold text-white">{dealLabel}</span>
                  {dealPrice && (
                    <span className="ml-auto flex items-baseline gap-1.5 pl-1">
                      <span className="text-[13px] font-black text-brand-300">{dealPrice}</span>
                      {dealWas && (
                        <span className="text-[10px] line-through opacity-60">{dealWas}</span>
                      )}
                    </span>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
