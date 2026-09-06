"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Zap,
  Moon,
  Sun,
  Menu,
  X,
  ShoppingCart,
  LogIn,
  Bell,
  ChevronDown,
  User as UserIcon,
  Package,
  Wallet,
  LogOut,
  Store,
} from "lucide-react";
import Logo from "./Logo";
import TimeAgo from "./TimeAgo";
import { AnyLogo } from "./BrandIcon";
import LocaleSwitcher from "./LocaleSwitcher";
import { useT } from "./LocaleProvider";
import { logoutAction } from "@/lib/actions/auth";
import { markNotificationsReadAction } from "@/lib/actions/shop";

export type HeaderUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  isSeller: boolean;
  sellerStatus: string | null;
  balance: number;
} | null;

export type HeaderNotif = { id: string; title: string; body: string | null; href: string | null; at: string; read: boolean };

const nav = [
  { label: "Home", key: "nav.home", href: "/" },
  { label: "Currency", key: "nav.currency", href: "/c/currency" },
  { label: "Top Up", key: "nav.topup", href: "/c/top-up" },
  { label: "Items", key: "nav.items", href: "/c/items" },
  { label: "Accounts", key: "nav.accounts", href: "/c/accounts" },
  { label: "Subscription", key: "nav.subscription", href: "/c/subscriptions" },
  { label: "Boosting", key: "nav.boosting", href: "/c/boosting" },
];

export default function Header({
  user,
  cartCount,
  notifications,
  unread,
  searchIndex,
  marquee = [],
}: {
  user: HeaderUser;
  cartCount: number;
  notifications: HeaderNotif[];
  unread: number;
  searchIndex: { label: string; href: string; logo: string; kind: string }[];
  marquee?: string[];
}) {
  const t = useT();
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const saved = localStorage.getItem("g2x.theme");
    if (saved) setDark(saved === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("g2x.theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setMenu(false);
        setBell(false);
        setFocus(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Lock page scroll behind the mobile menu overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
    setBell(false);
  }, [path]);

  const results = q.trim()
    ? searchIndex
        .filter((r) => r.label.toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div
      ref={box}
      className="sticky top-0 z-50 border-b border-[var(--line)] backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}
    >
      {/* announcement — admin-managed (Admin → CMS Blocks → Announcement Bar) */}
      {marquee.length > 0 && (
        <div className="overflow-hidden border-b border-[var(--line)] bg-brand-600/10 py-1.5">
          <div className="flex w-max animate-marquee gap-12 pr-12">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold tracking-wide text-brand-500"
              >
                <Zap size={12} className="fill-brand-500" />
                {marquee[i % marquee.length]}
              </span>
            ))}
          </div>
        </div>
      )}

      <header className="relative">
        <div className="mx-auto flex h-[62px] max-w-[1220px] items-center gap-3 px-3 sm:px-4 xl:gap-4">
          <Link href="/">
            <Logo />
          </Link>

          <nav className="ml-1 hidden shrink-0 items-center gap-3.5 xl:flex 2xl:gap-4">
            {nav.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link
                  key={n.label}
                  href={n.href}
                  className={`relative whitespace-nowrap py-1.5 text-[13px] font-medium transition-colors hover:text-brand-500 ${
                    active ? "text-brand-500" : ""
                  }`}
                >
                  {t(n.key)}
                  {active && (
                    <motion.span
                      layoutId="navline"
                      className="absolute -bottom-1 left-0 h-[2.5px] w-full rounded-full bg-brand-500"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            {/* search — the flexible element; nav + controls keep their width */}
            <div className="relative hidden min-w-0 flex-1 md:block">
              <div className="flex h-9 w-full max-w-[260px] items-center gap-2 rounded-full border border-[var(--line)] px-3.5 soft transition-all focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_rgba(139,61,255,.14)]">
                <Search size={14} className="muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onFocus={() => setFocus(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && results[0]) router.push(results[0].href);
                  }}
                  placeholder={t("nav.search")}
                  className="w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--muted)]"
                />
              </div>
              <AnimatePresence>
                {focus && results.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="fixed inset-x-3 top-[96px] z-[95] max-h-[min(70vh,420px)] overflow-y-auto rounded-xl panel p-1.5 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[44px] sm:w-[330px]"
                  >
                    {results.map((r) => (
                      <Link
                        key={r.href + r.label}
                        href={r.href}
                        onClick={() => {
                          setFocus(false);
                          setQ("");
                        }}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-brand-600/10"
                      >
                        <AnyLogo logo={r.logo} size={22} />
                        <span className="truncate text-[12.5px]">{r.label}</span>
                        <span className="ml-auto shrink-0 text-[10px] muted">{r.kind}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={() => {
                    setBell((b) => !b);
                    if (unread > 0) startTransition(() => void markNotificationsReadAction());
                  }}
                  className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] transition-all hover:border-brand-500 hover:text-brand-500"
                  aria-label="Notifications"
                >
                  <Bell size={15} />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {bell && (
                    <>
                      {/* tap-anywhere backdrop for the mobile sheet */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setBell(false)}
                        className="fixed inset-0 z-[90] bg-black/50 sm:hidden"
                      />
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="fixed inset-x-3 top-[96px] z-[95] max-h-[min(70vh,420px)] overflow-y-auto rounded-xl panel p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[44px] sm:w-[320px]"
                    >
                      <div className="flex items-center px-2 py-1.5 text-[12px] font-bold">
                        {t("dash.notifications")}
                        <button
                          onClick={() => setBell(false)}
                          className="ml-auto rounded-md p-1 muted hover:text-brand-400 sm:hidden"
                          aria-label={t("common.close")}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {notifications.length === 0 && (
                        <div className="px-2 py-8 text-center text-[11.5px] muted">{t("dash.nothingYet")}</div>
                      )}
                      {notifications.slice(0, 6).map((n) => (
                        <Link
                          key={n.id}
                          href={n.href || "/dashboard/notifications"}
                          className="block rounded-lg px-2 py-2 hover:bg-brand-600/10"
                        >
                          <div className="text-[12px] font-medium">{n.title}</div>
                          {n.body && <div className="mt-0.5 line-clamp-2 text-[11px] muted">{n.body}</div>}
                          <TimeAgo at={n.at} className="mt-0.5 block text-[10px] muted" />
                        </Link>
                      ))}
                      <Link
                        href="/dashboard/notifications"
                        className="mt-1 block rounded-lg px-2 py-2 text-center text-[11.5px] font-medium text-brand-500 hover:bg-brand-600/10"
                      >
                        {t("common.viewAll")}
                      </Link>
                    </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            <Link
              href="/cart"
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] transition-all hover:border-brand-500 hover:text-brand-500"
              aria-label="Cart"
            >
              <ShoppingCart size={15} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <div className="hidden shrink-0 sm:block">
              <LocaleSwitcher />
            </div>

            <button
              onClick={() => setDark((d) => !d)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] transition-all hover:rotate-12 hover:border-brand-500 hover:text-brand-500"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--line)] pl-1.5 pr-2.5 transition-all hover:border-brand-500"
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[10px] font-bold text-white">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden max-w-[80px] truncate text-[12.5px] font-medium sm:block">
                    {user.name.split(" ")[0]}
                  </span>
                  <ChevronDown size={13} className="muted" />
                </button>
                <AnimatePresence>{menu && <UserMenu user={user} />}</AnimatePresence>
              </div>
            ) : (
              /* compact single-line button — matches the 36px control height */
              <Link
                href="/login"
                className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3.5 text-[12.5px] font-semibold leading-none text-white shadow-[0_8px_20px_-10px_rgba(139,61,255,.95)] transition-all hover:-translate-y-0.5 hover:bg-brand-500"
              >
                <LogIn size={14} /> Login
                <span className="hidden sm:inline">&nbsp;/ Register</span>
              </Link>
            )}

            <button className="shrink-0 xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu: a floating overlay panel so it never pushes the page down */}
        <AnimatePresence>
          {open && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="fixed inset-0 top-[var(--hdr-h,108px)] z-40 bg-black/55 backdrop-blur-[2px] xl:hidden"
              />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute left-2 right-2 top-full z-50 mt-1.5 max-h-[calc(100dvh-var(--hdr-h,108px)-16px)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-2xl xl:hidden"
              >
                <div className="mb-1 border-b border-[var(--line)] pb-2 sm:hidden">
                  <LocaleSwitcher compact />
                </div>

                {nav.map((n) => {
                  const active = path === n.href;
                  return (
                    <Link
                      key={n.label}
                      href={n.href}
                      className={`flex items-center rounded-xl px-3 py-2.5 text-[13.5px] transition-colors ${
                        active ? "bg-brand-600/15 font-semibold text-brand-400" : "hover:bg-brand-600/10"
                      }`}
                    >
                      {t(n.key)}
                    </Link>
                  );
                })}

                {user?.isSeller && user.sellerStatus === "active" && (
                  <Link
                    href="/seller"
                    className="mt-1 flex items-center gap-2 rounded-xl bg-brand-600/10 px-3 py-2.5 text-[13.5px] font-semibold text-brand-400"
                  >
                    <Store size={15} /> Seller Panel
                  </Link>
                )}

                {!user && (
                  <Link
                    href="/login"
                    className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-[13.5px] font-semibold text-white"
                  >
                    <LogIn size={15} /> Login / Register
                  </Link>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </header>
    </div>
  );
}

function UserMenu({ user }: { user: NonNullable<HeaderUser> }) {
  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/orders", label: "My Orders", icon: Package },
    { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
    { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
  ];
  const sellerActive = user.isSeller && user.sellerStatus === "active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="absolute right-0 top-[44px] z-[95] w-[min(236px,calc(100vw-1.5rem))] rounded-xl panel p-2 shadow-2xl"
    >
      <div className="rounded-lg soft px-3 py-2.5">
        <div className="truncate text-[12.5px] font-semibold">{user.name}</div>
        <div className="truncate text-[10.5px] muted">{user.email}</div>
        <div className="mt-1.5 text-[11px]">
          Wallet <span className="font-bold text-brand-500">${user.balance.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-1.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] transition-colors hover:bg-brand-600/10 hover:text-brand-500"
          >
            <l.icon size={14} /> {l.label}
          </Link>
        ))}
        <Link
          href={sellerActive ? "/seller" : "/dashboard/become-seller"}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-brand-400 transition-colors hover:bg-brand-600/10"
        >
          <Store size={14} /> {sellerActive ? "Seller Panel" : "Become a Seller"}
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-rose-400 transition-colors hover:bg-rose-500/10"
          >
            <LogOut size={14} /> Logout
          </button>
        </form>
      </div>
    </motion.div>
  );
}
