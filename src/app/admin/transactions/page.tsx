import { requireAdmin } from "@/lib/admin";
import { adminTransactions } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { Tag } from "@/components/ui";
import { money, label } from "@/lib/fmt";
import LocalTime from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("payments");
  const rows = (await adminTransactions(200)) as {
    id: string; name: string; email: string; type: string; amount: number;
    reference: string; created_at: string;
  }[];
  return (
    <AdminPage title="Transactions" sub="Every movement of money on the platform.">
      <Table head={["When", "User", "Type", "Reference", "Amount"]}>
        {rows.map((t) => (
          <Tr key={t.id}>
            <Td className="whitespace-nowrap muted"><LocalTime at={t.created_at} /></Td>
            <Td>
              <div className="font-semibold">{t.name}</div>
              <div className="text-[10px] muted">{t.email}</div>
            </Td>
            <Td><Tag tone={["refund", "withdrawal"].includes(t.type) ? "red" : "green"}>{label(t.type)}</Tag></Td>
            <Td className="max-w-[240px] truncate muted">{t.reference}</Td>
            <Td className="font-bold">{money(t.amount)}</Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
