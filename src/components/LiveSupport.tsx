"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Headphones } from "lucide-react";

export default function LiveSupport() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, type: "spring" }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Link href="/support" className="group flex items-center gap-2">
        <span className="rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          Live Support
        </span>
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-white shadow-[0_10px_30px_-6px_rgba(139,61,255,.95)] transition-transform group-hover:scale-110">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/40" />
          <Headphones size={22} />
        </span>
      </Link>
    </motion.div>
  );
}
