"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Gamepad2, Layers, FileSliders, Package, Tags, Boxes, Upload,
  ShoppingCart, ListChecks, Truck, Users, Store, UserCheck, BadgeCheck, Award,
  ScanFace, CreditCard, Wallet, Banknote, Receipt, Percent, Gavel, LifeBuoy, MessagesSquare,
  Ticket, Megaphone, Home, Image as ImageIcon, BarChart3, TrendingUp, ShoppingBag,
  Package2, UserCog, Shield, KeyRound, Settings, ScrollText, LogOut, Menu, X,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { PermissionKey } from "@/lib/admin";

type Item = { href: string; label: string; icon: React.ElementType; perm: PermissionKey; badge?: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" }],
  },
  {
    title: "Games & Categories",
    items: [
      { href: "/admin/games", label: "Games", icon: Gamepad2, perm: "catalog" },
      { href: "/admin/categories", label: "Categories", icon: Layers, perm: "catalog" },
      { href: "/admin/templates", label: "Service Templates", icon: FileSliders, perm: "catalog" },
      { href: "/admin/options", label: "Dropdown Options", icon: ListChecks, perm: "catalog" },
    ],
  },
  {
    title: "Products & Offers",
    items: [
      { href: "/admin/products", label: "Products / Offers", icon: Package, perm: "catalog" },
      { href: "/admin/offers", label: "Manage Offers", icon: Tags, perm: "offers" },
      { href: "/admin/bulk", label: "Bulk Actions", icon: Boxes, perm: "catalog" },
      { href: "/admin/import", label: "Import / Export", icon: Upload, perm: "catalog" },
    ],
  },
  {
    title: "Orders",
    items: [
      { href: "/admin/orders", label: "All Orders", icon: ShoppingCart, perm: "orders" },
      { href: "/admin/order-status", label: "Order Status", icon: ListChecks, perm: "orders" },
      { href: "/admin/delivery-logs", label: "Delivery Logs", icon: Truck, perm: "orders" },
    ],
  },
  {
    title: "Users & Sellers",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, perm: "users" },
      { href: "/admin/sellers", label: "Sellers", icon: Store, perm: "sellers" },
      { href: "/admin/seller-requests", label: "Seller Requests", icon: UserCheck, perm: "sellers" },
      { href: "/admin/verifications", label: "Seller Verification", icon: BadgeCheck, perm: "verifications", badge: "verifications" },
      { href: "/admin/buyer-kyc", label: "Buyer KYC", icon: ScanFace, perm: "verifications", badge: "buyerKyc" },
      { href: "/admin/levels", label: "Seller Levels", icon: Award, perm: "sellers" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/gateways", label: "Payment Gateways", icon: CreditCard, perm: "payments" },
      { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "payments" },
      { href: "/admin/wallets", label: "Wallets", icon: Wallet, perm: "payments" },
      { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote, perm: "withdrawals", badge: "withdrawals" },
      { href: "/admin/transactions", label: "Transactions", icon: Receipt, perm: "payments" },
      { href: "/admin/commission", label: "Commission", icon: Percent, perm: "payments" },
    ],
  },
  {
    title: "Disputes & Support",
    items: [
      { href: "/admin/disputes", label: "Disputes", icon: Gavel, perm: "disputes", badge: "disputes" },
      { href: "/admin/tickets", label: "Support Tickets", icon: Ticket, perm: "disputes" },
      { href: "/admin/messages", label: "Messages", icon: MessagesSquare, perm: "messages", badge: "messages" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/promotions", label: "Promotions / Coupons", icon: LifeBuoy, perm: "promotions" },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone, perm: "promotions" },
      { href: "/admin/cms", label: "Homepage CMS", icon: Home, perm: "cms" },
      { href: "/admin/banners", label: "Banners", icon: ImageIcon, perm: "cms" },
      { href: "/admin/media", label: "Media Library", icon: ImageIcon, perm: "cms" },
      { href: "/admin/navigation", label: "Navigation & Footer", icon: ListChecks, perm: "cms" },
    ],
  },
  {
    title: "Reports & Analytics",
    items: [
      { href: "/admin/reports/sales", label: "Sales Reports", icon: BarChart3, perm: "reports" },
      { href: "/admin/reports/revenue", label: "Revenue Reports", icon: TrendingUp, perm: "reports" },
      { href: "/admin/reports/products", label: "Product Reports", icon: ShoppingBag, perm: "reports" },
      { href: "/admin/reports/sellers", label: "Seller Reports", icon: Package2, perm: "reports" },
      { href: "/admin/reports/users", label: "User Reports", icon: UserCog, perm: "reports" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/roles", label: "Admin Roles", icon: Shield, perm: "admins" },
      { href: "/admin/permissions", label: "Permissions", icon: KeyRound, perm: "admins" },
      { href: "/admin/settings", label: "System Settings", icon: Settings, perm: "settings" },
      { href: "/admin/activity", label: "Activity Logs", icon: ScrollText, perm: "settings" },
    ],
  },
];

export default function AdminNav({
  name, role, permissions, badges,
}: {
  name: string; role: string; permissions: PermissionKey[];
  badges: Record<string, number>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="space-y-3.5 pb-6">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => permissions.includes(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.title || "root"}>
            {g.title && (
              <div className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[.13em] muted">
                {g.title}
              </div>
            )}
            {items.map((l) => {
              const active = path === l.href;
              const count = l.badge ? badges[l.badge] ?? 0 : 0;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12px] transition-all hover:bg-brand-600/10 ${
                    active ? "font-semibold text-brand-400" : "muted"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="adminActive"
                      className="absolute inset-0 -z-10 rounded-lg bg-brand-600/15"
                    />
                  )}
                  <l.icon size={14} className="shrink-0" /> <span className="truncate">{l.label}</span>
                  {count > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* mobile bar */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 soft">
          <Menu size={17} />
        </button>
        <span className="text-[14px] font-black">
          G2X <span className="grad-text">Admin</span>
        </span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          >
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-[240px] overflow-y-auto border-r border-[var(--line)] bg-[var(--panel)] p-3"
            >
              <button onClick={() => setOpen(false)} className="mb-3 rounded-lg p-1.5 soft">
                <X size={16} />
              </button>
              {nav}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* desktop rail */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[228px] overflow-y-auto border-r border-[var(--line)] bg-[var(--panel)] px-3 py-4 lg:block">
        <Link href="/admin" className="mb-4 flex items-center gap-2 px-1">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-600 text-[13px] font-black text-white">
            G
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-black">G2X.GG</div>
            <div className="text-[9px] uppercase tracking-widest muted">Admin Panel</div>
          </div>
        </Link>

        <div className="mb-3 rounded-xl soft p-2.5">
          <div className="truncate text-[11.5px] font-bold">{name}</div>
          <div className="text-[10px] text-brand-400">{role}</div>
        </div>

        {nav}

        <div className="border-t border-[var(--line)] pt-2">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] muted hover:text-brand-400">
            <Home size={14} /> View site
          </Link>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-rose-400 hover:bg-rose-500/10">
              <LogOut size={14} /> Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
