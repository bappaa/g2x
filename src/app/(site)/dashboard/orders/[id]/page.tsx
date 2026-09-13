import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/queries";
import { one } from "@/lib/db";
import OrderDetail from "@/components/dash/OrderDetail";
import { sweepEscrowInBackground } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  // Release any escrow that has come due. Without this an order sat on
  // "Delivered" until someone happened to open a dashboard.
  sweepEscrowInBackground();
  const u = await requireUser();
  const data = await getOrder(params.id, u.id);
  if (!data) notFound();

  /**
   * Only a boolean crosses to the client. The review body must never reach the
   * buyer's browser — they can write a review but not read it back.
   */
  const sellerId = (data.items as { seller_id: string }[])[0]?.seller_id ?? "";
  const existing = sellerId
    ? await one<{ id: string }>(
        `SELECT id FROM reviews WHERE order_id=? AND buyer_id=? AND seller_id=?`,
        [(data.order as { id: string }).id, u.id, sellerId]
      )
    : null;
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl soft" />}>
    <OrderDetail
      order={data.order as never}
      items={data.items as never}
      events={data.events as never}
      review={{
        sellerId,
        storeName: (data.items as { store_name: string }[])[0]?.store_name ?? "the seller",
        reviewed: !!existing,
      }}
    />
    </Suspense>
  );
}
