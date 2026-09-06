import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getSellerProfile } from "@/lib/queries";
import { one } from "@/lib/db";
import SellerNav from "@/components/seller/SellerNav";
import PanelShell from "@/components/dash/PanelShell";

export const dynamic = "force-dynamic";

type Prof = { store_name: string; slug: string; level: string; status: string; rating: number; available_bal: number; pending_bal: number };

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/seller");
  const prof = (await getSellerProfile(u.id)) as Prof | null;
  if (!prof) redirect("/dashboard/become-seller");
  if (prof.status !== "active") redirect("/dashboard/become-seller");

  const pending = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM order_items WHERE seller_id=? AND status='processing'`,
    [u.id]
  );

  return (
    <PanelShell
      title="Seller Panel"
      storageKey="g2x_seller_collapsed"
      sidebar={
        <SellerNav
          store={prof.store_name}
          level={prof.level}
          rating={prof.rating}
          available={prof.available_bal}
          pendingBal={prof.pending_bal}
          toDeliver={Number(pending?.n ?? 0)}
        />
      }
    >
      {children}
    </PanelShell>
  );
}
