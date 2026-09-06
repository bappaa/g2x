"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { CategoryIcon } from "./CategoryIcon";
import { useT } from "./LocaleProvider";

export type ServiceItem = {
  slug: string; name: string; blurb: string; icon: string; badge?: string;
};

/**
 * Category shortcut rail. Driven entirely by the `categories` table —
 * adding or removing a category in the admin panel changes this instantly.
 *
 * Mobile: 2 columns. Tablet: 3. Desktop: one row of 6.
 */
export default function Services({ items }: { items: ServiceItem[] }) {
  const t = useT();
  if (!items.length) return null;

  return (
    <section className="mx-auto max-w-[1220px] px-3 sm:px-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {items.map((it, idx) => (
          <motion.div
            key={it.slug}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: Math.min(idx * 0.05, 0.3), duration: 0.4 }}
          >
            <Link
              href={`/c/${it.slug}`}
              className="group relative flex h-full flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-2.5 py-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/60 hover:shadow-[0_18px_40px_-24px_rgba(139,61,255,.9)] sm:py-6"
            >
              {it.badge && (
                <span className="absolute right-2 top-2 rounded-md bg-brand-600 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
                  {it.badge}
                </span>
              )}
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/[.04] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 sm:h-12 sm:w-12">
                <CategoryIcon name={it.icon} slug={it.slug} size={24} />
              </div>
              <div className="mt-2.5 text-[12.5px] font-bold leading-tight sm:text-[13.5px]">
                {t(`cat.${it.slug}`, it.name)}
              </div>
              {it.blurb && (
                <div className="mt-1 text-[10px] leading-tight muted sm:text-[10.5px]">{it.blurb}</div>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
