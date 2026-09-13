import { requireAdmin } from "@/lib/admin";
import { allGateways } from "@/lib/gateways";
import { AdminPage } from "@/components/admin/ui";
import GatewaysManager from "@/components/admin/GatewaysManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("payments");
  const rows = await allGateways();
  return (
    <AdminPage
      title="Payment Gateways"
      sub="Fees set here apply across the whole site — wallet top-ups and checkout both use them."
    >
      <GatewaysManager rows={rows as never} />
    </AdminPage>
  );
}
