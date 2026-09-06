import { requireAdmin } from "@/lib/admin";
import { adminWithdrawals } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import WithdrawalsManager from "@/components/admin/WithdrawalsManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin("withdrawals");
  const status = searchParams.status ?? "pending";
  const rows = await adminWithdrawals(status);
  return (
    <AdminPage title="Withdrawals" sub="Seller payout requests. Approving marks funds as leaving escrow.">
      <FilterTabs base="/admin/withdrawals" tabs={["pending", "approved", "paid", "rejected", "all"]} active={status} />
      <WithdrawalsManager rows={rows as never} />
    </AdminPage>
  );
}
