import { requireAdmin } from "@/lib/admin";
import { adminDeliveryLogs } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { Tag } from "@/components/ui";
import { when, statusTone, label } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("orders");
  const rows = (await adminDeliveryLogs(200)) as {
    id: string; title: string; status: string; delivered_at: string;
    code: string; store_name: string; buyer_name: string;
  }[];
  return (
    <AdminPage title="Delivery Logs" sub="Proof of when each item was handed over to the buyer.">
      <Table head={["Delivered", "Order", "Item", "Seller", "Buyer", "Status"]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="whitespace-nowrap muted">{when(r.delivered_at)}</Td>
            <Td className="font-mono text-[11px] font-bold">{r.code}</Td>
            <Td className="max-w-[220px] truncate">{r.title}</Td>
            <Td className="muted">{r.store_name ?? "—"}</Td>
            <Td className="muted">{r.buyer_name}</Td>
            <Td><Tag tone={statusTone(r.status)}>{label(r.status)}</Tag></Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
