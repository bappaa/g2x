import { requireUser } from "@/lib/session";
import { getSellerProfile } from "@/lib/queries";
import StoreSettings from "@/components/seller/StoreSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store Settings — G2X.GG" };

type Prof = {
  store_name: string; slug: string; description: string | null; logo: string | null;
  banner: string | null; payout_method: string | null; payout_detail: string | null;
  level: string; rating: number; total_orders: number; commission_pct: number; verified: number;
};

export default async function Page() {
  const u = await requireUser();
  const p = (await getSellerProfile(u.id)) as Prof;
  return <StoreSettings profile={p} />;
}
