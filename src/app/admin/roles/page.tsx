import { requireAdmin, PERMISSIONS } from "@/lib/admin";
import { adminRoles, adminAdmins } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import RolesManager from "@/components/admin/RolesManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("admins");
  const [roles, admins] = await Promise.all([adminRoles(), adminAdmins()]);
  return (
    <AdminPage title="Admin Roles" sub="Who can access which part of this panel.">
      <RolesManager
        roles={roles as never}
        admins={admins as never}
        permissions={PERMISSIONS.map((p) => ({ key: p.key as string, label: p.label }))}
      />
    </AdminPage>
  );
}
