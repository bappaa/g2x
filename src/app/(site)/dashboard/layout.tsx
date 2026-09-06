import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { one } from "@/lib/db";
import { getUnreadCount } from "@/lib/queries";
import DashboardNav from "@/components/dash/DashboardNav";
import PanelShell from "@/components/dash/PanelShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/dashboard");

  const [stats, unread] = await Promise.all([
    one<{ orders: number }>(`SELECT COUNT(*) AS orders FROM orders WHERE buyer_id=?`, [u.id]),
    getUnreadCount(u.id),
  ]);

  return (
    <PanelShell
      title="Dashboard"
      storageKey="g2x_dash_collapsed"
      sidebar={
        <DashboardNav
          name={u.name}
          balance={Number(u.balance ?? 0)}
          orders={Number(stats?.orders ?? 0)}
          unread={unread}
          isSeller={!!u.isSeller}
        />
      }
    >
      {children}
    </PanelShell>
  );
}
