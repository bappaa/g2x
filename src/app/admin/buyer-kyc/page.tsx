import { requireAdmin } from "@/lib/admin";
import { all } from "@/lib/db";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import BuyerKycReview from "@/components/admin/BuyerKycReview";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin("verifications");
  const status = searchParams.status ?? "pending";

  const rows = await all(
    `SELECT v.*, u.name AS user_name, u.email, u.balance
       FROM buyer_verifications v
       JOIN users u ON u.id = v.user_id
      ${status !== "all" ? "WHERE v.status=?" : ""}
      ORDER BY v.submitted_at DESC
      LIMIT 200`,
    status !== "all" ? [status] : []
  );

  return (
    <AdminPage
      title="Buyer Identity Checks"
      sub="Buyers must pass this before depositing or spending above the threshold set in Settings. Documents are private and every view is audit-logged."
    >
      <FilterTabs
        base="/admin/buyer-kyc"
        tabs={["pending", "approved", "rejected", "resubmit", "all"]}
        active={status}
      />
      <BuyerKycReview rows={rows as never} />
    </AdminPage>
  );
}
