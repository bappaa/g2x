import { requireAdmin } from "@/lib/admin";
import { adminDisputes } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import DisputesManager from "@/components/admin/DisputesManager";
import { getDisputeMessages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string; code?: string } }) {
  await requireAdmin("disputes");
  const status = searchParams.status ?? "open";
  const rows = (await adminDisputes(status)) as { id: string; code: string }[];
  const active = searchParams.code
    ? rows.find((r) => r.code === searchParams.code)
    : rows[0];
  const messages = active ? await getDisputeMessages(active.id) : [];

  return (
    <AdminPage title="Disputes" sub="Read both sides, then issue a binding decision and refund.">
      <FilterTabs base="/admin/disputes" tabs={["open", "under_review", "resolved", "rejected", "all"]} active={status} />
      <DisputesManager rows={rows as never} messages={messages as never} activeCode={active?.code ?? ""} />
    </AdminPage>
  );
}
