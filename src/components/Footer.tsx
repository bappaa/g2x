"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import LocaleSwitcher from "./LocaleSwitcher";
import Logo from "./Logo";
import { BrandIcon, UpiMark } from "./BrandIcon";
import { CategoryIcon } from "./CategoryIcon";
import { useT } from "./LocaleProvider";

const socials = ["discord", "telegram", "x", "instagram", "youtube"];

export type FooterCol = { heading: string; links: { label: string; href: string }[] };
export type FooterService = { slug: string; name: string; blurb: string; icon: string };

/**
 * Footer. Link columns come from the `nav_links` table and the services rail
 * from the `categories` table, so everything here is editable from admin.
 */
export default function Footer({
  cols, services, blurb, siteName,
}: {
  cols: FooterCol[];
  services: FooterService[];
  blurb: string;
  siteName: string;
}) {
  const tr = useT();
  return (
    <footer className="mx-auto max-w-[1220px] px-3 pb-8 sm:px-4 sm:pb-10">
      <div className="rounded-2xl panel p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-[1.4fr_repeat(4,.8fr)_1.3fr] lg:gap-8">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/">
              <Logo />
            </Link>
            {blurb && (
              <p className="mt-3 max-w-[320px] text-[11.5px] leading-relaxed muted sm:mt-4 sm:max-w-[240px]">{blurb}</p>
            )}
            <div className="mt-4 flex gap-2.5 sm:mt-5">
              {socials.map((s) => (
                <button
                  key={s}
                  aria-label={s}
                  className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] transition-all hover:-translate-y-1 hover:border-brand-500"
                >
                  <BrandIcon name={s} size={14} color="currentColor" />
                </button>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.heading}>
              <div className="mb-2.5 text-[12.5px] font-bold sm:text-[13px]">
                {tr(`foot.${c.heading.toLowerCase().replace(/\s+/g, "")}`, c.heading)}
              </div>
              <ul className="space-y-1.5 sm:space-y-2">
                {c.links.map((l) => (
                  <li key={l.label + l.href}>
                    <Link
                      href={l.href}
                      className="block text-[11.5px] muted transition-all hover:pl-1 hover:text-brand-500"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 lg:col-span-1">
            <div className="mb-2.5 text-[12.5px] font-bold sm:text-[13px]">{tr("foot.services")}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {services.map((s, i) => (
                <motion.div
                  key={s.slug}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                >
                  <Link
                    href={`/c/${s.slug}`}
                    className="group flex w-full items-center gap-2.5 rounded-lg border border-[var(--line)] soft px-3 py-2 transition-all hover:border-brand-500"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--line)]">
                      <CategoryIcon name={s.icon} slug={s.slug} size={14} />
                    </span>
                    <span className="text-left leading-tight">
                      <span className="block text-[11.5px] font-semibold">{tr(`cat.${s.slug}`, s.name)}</span>
                      {s.blurb && <span className="block text-[10px] muted">{s.blurb}</span>}
                    </span>
                    <ArrowRight
                      size={13}
                      className="ml-auto muted transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4 border-t border-[var(--line)] pt-5 text-center sm:mt-7 md:flex-row md:text-left">
          <span className="order-3 text-[11px] muted md:order-1">
            © {new Date().getFullYear()} {siteName} - All Rights Reserved.
          </span>
          <div className="order-1 flex flex-wrap items-center justify-center gap-2.5 md:order-2 md:ml-auto md:gap-3">
            <span className="text-[11px] muted">{tr("foot.accept")}</span>
            {["visa", "mastercard", "paypal", "googlepay", "applepay"].map((p) => (
              <span
                key={p}
                className="grid h-7 w-11 place-items-center rounded-md border border-[var(--line)] soft transition-transform hover:scale-110"
              >
                <BrandIcon name={p} size={17} />
              </span>
            ))}
            <span className="grid h-7 w-11 place-items-center rounded-md border border-[var(--line)] soft transition-transform hover:scale-110">
              <UpiMark />
            </span>
          </div>
          {/* real language + currency switcher, same state as the header */}
          <div className="order-2 md:order-3">
            <FooterLocale />
          </div>
        </div>
      </div>
    </footer>
  );
}


/** Mirrors the header switcher so the footer control is not decorative. */
function FooterLocale() {
  // The switcher already renders the current language + currency, so showing a
  // second static copy next to it (the old markup) just duplicated the label.
  return (
    <div className="flex items-center">
      <LocaleSwitcher compact up />
    </div>
  );
}
