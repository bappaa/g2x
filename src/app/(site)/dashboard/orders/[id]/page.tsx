import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/queries";
import OrderDetail from "@/components/dash/OrderDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const u = await requireUser();
  const data = await getOrder(params.id, u.id);
  if (!data) notFound();
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl soft" />}>
    <OrderDetail
      order={data.order as never}
      items={data.items as never}
      events={data.events as never}
    />
    </Suspense>
  );
}
