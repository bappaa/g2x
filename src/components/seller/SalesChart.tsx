"use client";
import { motion } from "framer-motion";
import { useMoney } from "@/components/LocaleProvider";

export default function SalesChart({ data }: { data: { d: string; revenue: number; orders: number }[] }) {
  const money = useMoney();
  if (!data.length)
    return <div className="py-10 text-center text-[12px] muted">No sales in this period yet.</div>;

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const total = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[18px] font-black sm:text-[22px] text-brand-500">{money(total)}</span>
        <span className="text-[11.5px] muted">
          across {data.reduce((s, d) => s + d.orders, 0)} orders
        </span>
      </div>
      <div className="flex h-[130px] items-end gap-1.5">
        {data.map((d, i) => (
          <div key={d.d} className="group relative flex-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(4, (d.revenue / max) * 120)}px` }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 120 }}
              className="w-full rounded-t bg-gradient-to-t from-brand-700 to-brand-400"
            />
            <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] text-white group-hover:block">
              {money(d.revenue)} · {d.d.slice(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
