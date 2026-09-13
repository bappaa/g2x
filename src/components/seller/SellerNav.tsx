"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useMoney } from "@/components/LocaleProvider";
import {
  LayoutDashboard, Tag as TagIcon, Package, Star, Wallet, Store, Gavel, ArrowLeft,
  ChevronDown,
} from "lucide-react";

const links = [
  { href: "/seller", label: "Overview", icon: LayoutDashboard },
  { href: "/seller/orders", label: "Orders", icon: Package, badge: true },
  { href: "/seller/reviews", label: "Reviews", icon: Star },
  { href: "/seller/disputes", label: "Disputes", icon: Gavel },
  { href: "/seller/finance", label: "Finance & Payouts", icon: Wallet },
  { href: "/seller/store", label: "Store Settings", icon: Store },
];

/**
 * "My Offers" is now a category drawer instead of a flat link, and the old
 * standalone "Listings" page folds in as its first entry. Sellers think in
 * terms of *what they sell*, so the sub-items mirror the storefront
 * categories; each filters the offers table via `?cat=`.
 */
const OFFER_CATS = [
  { slug: "", label: "All listings" },
  { slug: "currency", label: "Currency" },
  { slug: "accounts", label: "Accounts" },
  { slug: "top-up", label: "Top Ups" },
  { slug: "items", label: "Items" },
  { slug: "subscriptions", label: "Subscriptions" },
  { slug: "boosting", label: "Boosting" },
];

export default function SellerNav({
  store, level, rating, available, pendingBal, toDeliver,
}: {
  store: string; level: string; rating: number; available: number; pendingBal: number; toDeliver: number;
}) {
  const money = useMoney();
  const path = usePathname();
  return (
    <div className="rounded-2xl panel p-3 sm:p-4">
      <div className="flex items-center gap-3 rounded-xl soft p-3 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:p-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-brand-600 text-[14px] font-black text-white">
            {store.slice(0, 1).toUpperCase()}
          </span>
        <div className="min-w-0 group-data-[collapsed=true]/rail:hidden">
          <div className="truncate text-[12.5px] font-bold">{store}</div>
          <div className="flex items-center gap-1 text-[10.5px] muted">
            <Star size={9} className="fill-amber-400 text-amber-400" /> {rating}% · {level}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 group-data-[collapsed=true]/rail:hidden">
        <div className="rounded-lg soft px-2.5 py-2">
          <div className="text-[10px] muted">Available</div>
          <div className="text-[13px] font-black text-emerald-400">{money(available)}</div>
        </div>
        <div className="rounded-lg soft px-2.5 py-2">
          <div className="text-[10px] muted">Escrow</div>
          <div className="text-[13px] font-black text-amber-400">{money(pendingBal)}</div>
        </div>
      </div>

      <nav className="mt-4 space-y-0.5">
          {/* Overview stays first, then the Offers drawer, then the rest. */}
          <NavLink l={links[0]} toDeliver={toDeliver} />
          <OffersDrawer />

          {links.slice(1).map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                title={l.label}
                className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-all hover:bg-brand-600/10 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0 ${
                  active ? "font-semibold text-brand-400" : "muted"
                }`}
              >
                {active && (
                  <motion.span layoutId="sellerActive" className="absolute inset-0 -z-10 rounded-lg bg-brand-600/15" />
                )}
                <l.icon size={15} className="shrink-0" />
                <span className="group-data-[collapsed=true]/rail:hidden">{l.label}</span>
                {l.badge && toDeliver > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[9.5px] font-bold text-white group-data-[collapsed=true]/rail:absolute group-data-[collapsed=true]/rail:right-1 group-data-[collapsed=true]/rail:top-1 group-data-[collapsed=true]/rail:ml-0 group-data-[collapsed=true]/rail:px-1">
                    {toDeliver}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>

      <Link
        href="/dashboard"
        title="Buyer dashboard"
        className="mt-4 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] muted transition-colors hover:text-brand-400 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0"
      >
        <ArrowLeft size={14} className="shrink-0" />
        <span className="group-data-[collapsed=true]/rail:hidden">Buyer dashboard</span>
      </Link>
    </div>
  );
}

type NavItem = { href: string; label: string; icon: typeof Package; badge?: boolean };

function NavLink({ l, toDeliver }: { l: NavItem; toDeliver: number }) {
  const path = usePathname();
  const active = path === l.href;
  return (
    <Link
      href={l.href}
      title={l.label}
      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-all hover:bg-brand-600/10 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0 ${
        active ? "font-semibold text-brand-400" : "muted"
      }`}
    >
      {active && (
        <motion.span layoutId="sellerActive" className="absolute inset-0 -z-10 rounded-lg bg-brand-600/15" />
      )}
      <l.icon size={15} className="shrink-0" />
      <span className="group-data-[collapsed=true]/rail:hidden">{l.label}</span>
      {l.badge && toDeliver > 0 && (
        <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[9.5px] font-bold text-white group-data-[collapsed=true]/rail:absolute group-data-[collapsed=true]/rail:right-1 group-data-[collapsed=true]/rail:top-1 group-data-[collapsed=true]/rail:ml-0 group-data-[collapsed=true]/rail:px-1">
          {toDeliver}
        </span>
      )}
    </Link>
  );
}

/** Expandable "My Offers" section — the old Listings page lives in here now. */
function OffersDrawer() {
  const path = usePathname();
  const params = useSearchParams();
  const onOffers = path.startsWith("/seller/offers") || path.startsWith("/seller/listings");
  const [open, setOpen] = useState(onOffers);
  const current = params.get("cat") ?? "";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="My Offers"
        className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-all hover:bg-brand-600/10 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0 ${
          onOffers ? "font-semibold text-brand-400" : "muted"
        }`}
      >
        <TagIcon size={15} className="shrink-0" />
        <span className="flex-1 text-left group-data-[collapsed=true]/rail:hidden">My Offers</span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform duration-200 group-data-[collapsed=true]/rail:hidden ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5 border-l border-[var(--line)] pl-3 group-data-[collapsed=true]/rail:hidden">
          {OFFER_CATS.map((c) => {
            const active = path.startsWith("/seller/offers") && current === c.slug;
            return (
              <Link
                key={c.slug || "all"}
                href={c.slug ? `/seller/offers?cat=${c.slug}` : "/seller/offers"}
                prefetch
                className={`block rounded-lg px-2.5 py-1.5 text-[12px] transition-colors hover:bg-brand-600/10 ${
                  active ? "bg-brand-600/15 font-semibold text-brand-400" : "muted"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
