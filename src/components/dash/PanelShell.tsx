"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, X, Menu } from "lucide-react";

/**
 * Shared layout for the buyer dashboard and seller panel.
 *
 * Desktop  — sidebar sits beside the content and can be collapsed to icons.
 * Mobile   — sidebar becomes an off-canvas drawer behind a sticky "Menu" bar,
 *            so the page content starts at the top of the screen instead of
 *            being pushed below a full-height nav.
 *
 * The collapsed preference is remembered in localStorage per panel.
 */
export default function PanelShell({
  sidebar,
  children,
  title,
  storageKey = "g2x_panel_collapsed",
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Shown in the mobile bar, e.g. "Dashboard" or "Seller Panel". */
  title: string;
  storageKey?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);        // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail
  const [ready, setReady] = useState(false);

  // Restore the desktop collapse preference.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(storageKey) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [storageKey]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Close the drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="mx-auto max-w-[1220px] px-3 py-4 sm:px-4 sm:py-6">
      {/* ---------- mobile bar ---------- */}
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-[12.5px] font-semibold transition-colors hover:border-brand-500 hover:text-brand-500"
        >
          <Menu size={15} /> {title}
        </button>
      </div>

      <div
        className={`grid gap-5 ${
          ready && collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[236px_1fr]"
        }`}
      >
        {/* ---------- desktop sidebar ---------- */}
        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-[150px] lg:self-start">
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] py-1.5 text-[11px] muted transition-colors hover:border-brand-500 hover:text-brand-500"
            >
              {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
              {!collapsed && "Collapse"}
            </button>
            <div data-collapsed={collapsed ? "true" : "false"} className="group/rail">
              {sidebar}
            </div>
          </div>
        </div>

        {/* ---------- content ---------- */}
        <div className="min-w-0">{children}</div>
      </div>

      {/* ---------- mobile drawer ---------- */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px] lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-[81] w-[280px] max-w-[86vw] overflow-y-auto bg-[var(--bg)] p-3 shadow-2xl lg:hidden"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[13px] font-black">{title}</span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 transition-colors hover:text-rose-400"
                >
                  <X size={16} />
                </button>
              </div>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
