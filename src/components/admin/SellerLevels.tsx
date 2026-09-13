"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reorder, motion } from "framer-motion";
import { GripVertical, Loader2, Save, Star, BadgeCheck } from "lucide-react";
import { Btn, Tag, Empty } from "@/components/ui";
import { money } from "@/lib/fmt";
import { reorderSellersAction } from "@/lib/actions/admin";

type S = {
  user_id: string; store_name: string; level: string; rating: number; total_sales: number;
  verified: number; top_seller: number; custom_badge: string | null; available_bal: number;
};

export default function SellerLevels({ rows }: { rows: S[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(rows);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = order.map((o) => o.user_id).join() !== rows.map((r) => r.user_id).join();

  if (!rows.length) return <Empty title="No active sellers" sub="Approve a seller first." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] muted">Drag a store to change its ranking.</span>
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-[11.5px] text-emerald-400">Saved</span>}
          <Btn
            className="flex items-center gap-2"
            disabled={!dirty || pending}
            onClick={() =>
              start(async () => {
                await reorderSellersAction(order.map((o) => o.user_id));
                setSaved(true);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save order
          </Btn>
        </div>
      </div>

      <Reorder.Group axis="y" values={order} onReorder={(v) => { setOrder(v); setSaved(false); }} className="space-y-2">
        {order.map((s, i) => (
          <Reorder.Item key={s.user_id} value={s} className="cursor-grab active:cursor-grabbing">
            <motion.div layout className="flex items-center gap-3 rounded-2xl panel p-3.5">
              <GripVertical size={14} className="muted" />
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-600/15 text-[11px] font-black text-brand-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[13px] font-bold">
                  {s.store_name}
                  {s.verified === 1 && <BadgeCheck size={12} className="text-brand-400" />}
                </div>
                <div className="flex items-center gap-2 text-[10.5px] muted">
                  <span className="flex items-center gap-0.5">
                    <Star size={9} className="fill-amber-400 text-amber-400" /> {Number(s.rating ?? 0).toFixed(1)}
                  </span>
                  · {s.total_sales} sales · {money(s.available_bal)}
                </div>
              </div>
              {s.top_seller === 1 && <Tag tone="amber">Top Seller</Tag>}
              {s.custom_badge && <Tag tone="brand">{s.custom_badge}</Tag>}
              <Tag tone="slate">{s.level}</Tag>
            </motion.div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
