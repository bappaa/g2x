"use client";
import { useMoney } from "@/components/LocaleProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Package, Box, Wallet, Receipt, Gavel, Star, Heart, Bell,
  MessageSquare, User, Shield, Store, LogOut,
  BadgeCheck,
} from "lucide-react";

import { logoutAction } from "@/lib/actions/auth";

const groups = [
  { title: "Overview", links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Purchases",
    links: [
      { href: "/dashboard/orders", label: "My Orders", icon: Package },
      { href: "/dashboard/products", label: "Purchased Products", icon: Box },
      { href: "/dashboard/wishlist", label: "Wishlist", icon: Heart },
      { href: "/dashboard/reviews", label: "My Reviews", icon: Star },
    ],
  },
  {
    title: "Finance",
    links: [
      { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
      { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/dashboard/disputes", label: "Disputes", icon: Gavel },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: true },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/dashboard/profile", label: "Profile", icon: User },
      { href: "/dashboard/verification", label: "Verification", icon: BadgeCheck },
      { href: "/dashboard/security", label: "Security", icon: Shield },
    ],
  },
];

export default function DashboardNav({
  name, balance, orders, unread, isSeller,
}: {
  name: string; balance: number; orders: number; unread: number; isSeller: boolean;
}) {
  const money = useMoney();
  const path = usePathname();

  return (
    <div className="rounded-2xl panel p-3 sm:p-4">
      <div className="flex items-center gap-3 rounded-xl soft p-3 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:p-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[14px] font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        <div className="min-w-0 group-data-[collapsed=true]/rail:hidden">
          <div className="truncate text-[12.5px] font-bold">{name}</div>
          <div className="text-[10.5px] muted">{isSeller ? "Buyer + Seller" : "Buyer Account"}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 group-data-[collapsed=true]/rail:hidden">
        <div className="rounded-lg soft px-2.5 py-2">
          <div className="text-[10px] muted">Wallet</div>
          <div className="text-[13px] font-black text-brand-500">{money(balance)}</div>
        </div>
        <div className="rounded-lg soft px-2.5 py-2">
          <div className="text-[10px] muted">Orders</div>
          <div className="text-[13px] font-black">{orders}</div>
        </div>
      </div>

      <nav className="mt-4 space-y-3.5">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-1.5 px-2 text-[9.5px] font-bold uppercase tracking-widest muted group-data-[collapsed=true]/rail:hidden">
                {g.title}
              </div>
              {g.links.map((l) => {
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
                      <motion.span
                        layoutId="dashActive"
                        className="absolute inset-0 -z-10 rounded-lg bg-brand-600/15"
                      />
                    )}
                    <l.icon size={15} className="shrink-0" />
                    <span className="group-data-[collapsed=true]/rail:hidden">{l.label}</span>
                    {"badge" in l && l.badge && unread > 0 && (
                      <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[9.5px] font-bold text-white group-data-[collapsed=true]/rail:absolute group-data-[collapsed=true]/rail:right-1 group-data-[collapsed=true]/rail:top-1 group-data-[collapsed=true]/rail:ml-0 group-data-[collapsed=true]/rail:px-1">
                        {unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          <div>
            <div className="mb-1.5 px-2 text-[9.5px] font-bold uppercase tracking-widest muted group-data-[collapsed=true]/rail:hidden">
              Selling
            </div>
            <Link
              href={isSeller ? "/seller" : "/dashboard/become-seller"}
              title={isSeller ? "Seller Panel" : "Become a Seller"}
              className="flex items-center gap-2.5 rounded-lg bg-brand-600/10 px-2.5 py-2 text-[12.5px] font-semibold text-brand-400 transition-all hover:bg-brand-600/20 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0"
            >
              <Store size={15} className="shrink-0" />
              <span className="group-data-[collapsed=true]/rail:hidden">
                {isSeller ? "Seller Panel" : "Become a Seller"}
              </span>
            </Link>
          </div>

          <form action={logoutAction}>
            <button
              title="Logout"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-rose-400 transition-colors hover:bg-rose-500/10 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0"
            >
              <LogOut size={15} className="shrink-0" />
              <span className="group-data-[collapsed=true]/rail:hidden">Logout</span>
            </button>
          </form>
      </nav>
    </div>
  );
}
