"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Pause, Play, Star, Pin, Sparkles, Ban } from "lucide-react";
import { Tag, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { adminOfferStatusAction, adminOfferFlagsAction } from "@/lib/actions/admin";

type O = {
  id: string; product_name: string; game_name: string; category_name: string;
  store_name: string; price: number; stock: number; delivery_time: string;
  status: string; featured: number; recommended: number; pinned: number; updated_at: string;
};

export default function OffersModeration({ rows, q }: { rows: O[]; q: string }) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const [busy, start] = useTransition();

  const setStatus = (o: O, status: string) => {
    const note = status === "rejected" ? prompt("Reason shown to the seller:") ?? "" : "";
    if (status === "rejected" && !note) return;
    start(async () => {
      await adminOfferStatusAction(o.id, status, note);
      router.refresh();
    });
  };

  const flag = (o: O, key: "featured" | "recommended" | "pinned") =>
    start(async () => {
      await adminOfferFlagsAction(o.id, { [key]: o[key] !== 1 });
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Toolbar>
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => { e.preventDefault(); router.push(`/admin/offers?q=${encodeURIComponent(term)}`); }}
        >
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input className={`${inputCls} pl-8`} placeholder="Product or store…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
        <span className="text-[11.5px] muted">{rows.length} offers</span>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No offers" sub="Nothing matches this filter." />
      ) : (
        <Table head={["Offer", "Seller", "Price", "Stock", "Delivery", "Flags", "Status", ""]}>
          {rows.map((o) => (
            <Tr key={o.id}>
              <Td>
                <div className="font-semibold">{o.product_name}</div>
                <div className="text-[10px] muted">{o.game_name} · {o.category_name}</div>
              </Td>
              <Td className="muted">{o.store_name}</Td>
              <Td className="font-bold">{money(o.price)}</Td>
              <Td className={o.stock > 0 ? "muted" : "text-rose-400"}>{o.stock}</Td>
              <Td className="muted">{o.delivery_time}</Td>
              <Td>
                <div className="flex gap-1">
                  <IconAction title="Featured" onClick={() => flag(o, "featured")} disabled={busy}>
                    <Star size={11} className={o.featured === 1 ? "fill-amber-400 text-amber-400" : ""} />
                  </IconAction>
                  <IconAction title="Recommended" onClick={() => flag(o, "recommended")} disabled={busy}>
                    <Sparkles size={11} className={o.recommended === 1 ? "text-brand-400" : ""} />
                  </IconAction>
                  <IconAction title="Pinned" onClick={() => flag(o, "pinned")} disabled={busy}>
                    <Pin size={11} className={o.pinned === 1 ? "text-emerald-400" : ""} />
                  </IconAction>
                </div>
              </Td>
              <Td><Tag tone={statusTone(o.status)}>{label(o.status)}</Tag></Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  {o.status === "active" ? (
                    <IconAction title="Pause" onClick={() => setStatus(o, "paused")} disabled={busy}><Pause size={12} /></IconAction>
                  ) : (
                    <IconAction title="Activate" onClick={() => setStatus(o, "active")} disabled={busy}><Play size={12} /></IconAction>
                  )}
                  <IconAction title="Reject" danger onClick={() => setStatus(o, "rejected")} disabled={busy}>
                    <Ban size={12} />
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
