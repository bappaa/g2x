"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

export type Banner = {
  id: string; title: string; subtitle: string; image: string;
  cta_label: string; cta_href: string; bg_color: string;
};

/** Admin-managed hero slider. Renders nothing when no banners are published. */
export default function BannerSlider({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[i % banners.length];

  return (
    <section className="mx-auto w-full max-w-[1240px] px-4 pt-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--line)]"
        style={{ background: b.bg_color || "#8b3dff" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative min-h-[190px] sm:min-h-[230px]"
          >
            {b.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
            <div className="relative z-10 max-w-[620px] p-6 sm:p-9">
              <motion.h2
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="text-[24px] font-black leading-tight text-white sm:text-[34px]"
              >
                {b.title}
              </motion.h2>
              {b.subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  className="mt-2 text-[13px] text-white/85 sm:text-[15px]"
                >
                  {b.subtitle}
                </motion.p>
              )}
              {b.cta_label && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                  <Link
                    href={b.cta_href || "/"}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-[13px] font-bold text-slate-900 transition-transform hover:scale-[1.03]"
                  >
                    {b.cta_label} <ArrowRight size={14} />
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {banners.length > 1 && (
          <div className="absolute bottom-4 right-5 z-10 flex gap-1.5">
            {banners.map((x, n) => (
              <button
                key={x.id}
                aria-label={`Slide ${n + 1}`}
                onClick={() => setI(n)}
                className={`h-1.5 rounded-full transition-all ${
                  n === i % banners.length ? "w-6 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
