import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getSellerOrders } from "@/lib/queries";
import SellerOrders from "@/components/seller/SellerOrders";
import { sweepEscrowInBackground } from "@/lib/escrow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller Orders — G2X.GG" };

const TABS = ["all", "processing", "delivered", "completed", "cancelled", "disputed"];

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  // Release any escrow that has come due. Without this an order sat on
  // "Delivered" until someone happened to open a dashboard.
  sweepEscrowInBackground();
  const u = await requireUser();
  const status = searchParams.status ?? "all";
  const orders = await getSellerOrders(u.id, status);

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Orders</h1>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/seller/orders" : `/seller/orders?status=${t}`}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
              status === t ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>
      <SellerOrders orders={orders as never} />
    </div>
  );
}
