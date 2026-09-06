import { requireAdmin } from "@/lib/admin";
import { adminUsers } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import UsersManager from "@/components/admin/UsersManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { role?: string; q?: string } }) {
  await requireAdmin("users");
  const role = searchParams.role ?? "all";
  const rows = await adminUsers({ role, q: searchParams.q, limit: 200 });
  return (
    <AdminPage title="Users" sub="Search accounts, suspend abusers and adjust wallet balances.">
      <FilterTabs base="/admin/users" tabs={["all", "user", "seller", "admin"]} active={role} param="role" />
      <UsersManager rows={rows as never} q={searchParams.q ?? ""} />
    </AdminPage>
  );
}
