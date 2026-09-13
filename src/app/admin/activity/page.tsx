import { requireAdmin } from "@/lib/admin";
import { adminActivity } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { label } from "@/lib/fmt";
import LocalTime from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("settings");
  const rows = (await adminActivity(200)) as {
    id: string; name: string; action: string; target: string; meta: string | null; created_at: string;
  }[];

  return (
    <AdminPage title="Activity Logs" sub="Every admin action is recorded here — immutable and searchable.">
      <Table head={["When", "Admin", "Action", "Target", "Details"]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="whitespace-nowrap muted"><LocalTime at={r.created_at} /></Td>
            <Td className="font-semibold">{r.name ?? "—"}</Td>
            <Td>
              <span className="rounded bg-brand-600/12 px-1.5 py-0.5 text-[10.5px] text-brand-400">
                {label(r.action)}
              </span>
            </Td>
            <Td className="muted">{r.target}</Td>
            <Td className="max-w-[280px] truncate text-[10.5px] muted">{r.meta ?? "—"}</Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
