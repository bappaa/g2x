"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, Store, ArrowLeftRight, Sparkles } from "lucide-react";

/**
 * WHICH PANEL AM I IN?
 * ====================
 * A seller is also a buyer, and both panels share the same shell, header and
 * colours. People genuinely lose track of which side they are on — and then
 * wonder why their wallet or their orders "look wrong".
 *
 * So each panel states itself in a coloured banner, and the banner doubles as
 * the switch to the other side:
 *
 *   Buyer panel   -> brand purple  -> "Switch to Seller Panel" / "Become a Seller"
 *   Seller panel  -> amber         -> "Switch to Buyer Panel"
 *
 * Making the CTA part of the badge is deliberate: the client asked for the
 * seller button to be impossible to miss, and the one element people already
 * look at to orient themselves is the best place to put it.
 */
export default function PanelBadge({
  panel,
  isSeller = false,
  sellerActive = false,
}: {
  panel: "buyer" | "seller";
  /** Has a seller profile of any status. */
  isSeller?: boolean;
  /** Seller profile is approved and active. */
  sellerActive?: boolean;
}) {
  const buyer = panel === "buyer";

  // Where the CTA sends them, and what it says.
  const cta = buyer
    ? sellerActive
      ? { href: "/seller", label: "Switch to Seller Panel", icon: ArrowLeftRight }
      : isSeller
        ? { href: "/dashboard/become-seller", label: "Seller application", icon: Store }
        : { href: "/dashboard/become-seller", label: "Become a Seller", icon: Sparkles }
    : { href: "/dashboard", label: "Switch to Buyer Panel", icon: ArrowLeftRight };

  const Icon = cta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
        buyer
          ? "border-brand-500/40 bg-brand-600/10"
          : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          buyer ? "bg-brand-600/20 text-brand-400" : "bg-amber-500/20 text-amber-400"
        }`}
      >
        {buyer ? <ShoppingBag size={16} /> : <Store size={16} />}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] font-black tracking-tight ${
            buyer ? "text-brand-300" : "text-amber-300"
          }`}
        >
          {buyer ? "You are in the Buyer Panel" : "You are in the Seller Panel"}
        </div>
        <div className="text-[11px] muted">
          {buyer
            ? "Your orders, wallet and purchases."
            : "Your offers, sales and payouts."}
        </div>
      </div>

      <Link
        href={cta.href}
        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 ${
          buyer
            ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-500/25"
            : "bg-gradient-to-r from-brand-500 to-brand-700 shadow-brand-500/25"
        }`}
      >
        <Icon size={14} />
        {cta.label}
      </Link>
    </motion.div>
  );
}
