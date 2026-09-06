import { requireAdmin, PERMISSIONS } from "@/lib/admin";
import { adminRoles } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { Check, Minus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("admins");
  const roles = (await adminRoles()) as { id: string; name: string; permissions: string }[];
  const perms = PERMISSIONS.map((p) => ({ key: p.key as string, label: p.label }));
  const has = (r: { permissions: string }, k: string) => {
    try {
      const p = JSON.parse(r.permissions) as string[];
      return p.includes("*") || p.includes(k);
    } catch {
      return false;
    }
  };

  return (
    <AdminPage title="Permissions" sub="The full permission matrix. Edit a role on the Admin Roles page.">
      <Table head={["Permission", ...roles.map((r) => r.name)]}>
        {perms.map((p) => (
          <Tr key={p.key}>
            <Td>
              <div className="font-semibold">{p.label}</div>
              <div className="font-mono text-[10px] muted">{p.key}</div>
            </Td>
            {roles.map((r) => (
              <Td key={r.id}>
                {has(r, p.key)
                  ? <Check size={13} className="text-emerald-400" />
                  : <Minus size={13} className="muted" />}
              </Td>
            ))}
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
