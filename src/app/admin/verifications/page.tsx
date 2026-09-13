import { requireAdmin } from "@/lib/admin";
import { adminVerifications } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import VerificationReview from "@/components/admin/VerificationReview";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin("verifications");
  const status = searchParams.status ?? "pending";
  const rows = await adminVerifications(status);

  return (
    <AdminPage
      title="Seller Verification"
      sub="Every seller must pass a government-ID check before they can list. Documents are private and audit-logged."
    >
      <FilterTabs
        base="/admin/verifications"
        tabs={["pending", "approved", "rejected", "resubmit", "all"]}
        active={status}
      />
      <VerificationReview rows={rows as never} />
    </AdminPage>
  );
}
