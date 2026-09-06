import { requireAdmin } from "@/lib/admin";
import { adminTickets } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import TicketsManager from "@/components/admin/TicketsManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin("disputes");
  const status = searchParams.status ?? "open";
  const rows = await adminTickets(status);
  return (
    <AdminPage title="Support Tickets" sub="Buyer and seller help requests.">
      <FilterTabs base="/admin/tickets" tabs={["open", "pending", "resolved", "closed", "all"]} active={status} />
      <TicketsManager rows={rows as never} />
    </AdminPage>
  );
}
