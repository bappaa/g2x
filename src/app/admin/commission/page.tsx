import { requireAdmin } from "@/lib/admin";
import { adminCommission } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { money } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("payments");
  const rows = (await adminCommission()) as {
    store_name: string; commission_pct: number; orders: number; gross: number; commission: number;
  }[];
  const total = rows.reduce((s, r) => s + Number(r.commission), 0);

  return (
    <AdminPage title="Commission" sub={`${money(total)} earned in commission to date. Set per-seller rates on the Sellers page.`}>
      <Table head={["Store", "Rate", "Orders", "Gross sales", "Commission earned"]}>
        {rows.map((r, i) => (
          <Tr key={i}>
            <Td className="font-semibold">{r.store_name ?? "—"}</Td>
            <Td className="muted">{Number(r.commission_pct)}%</Td>
            <Td className="muted">{r.orders}</Td>
            <Td>{money(r.gross)}</Td>
            <Td className="font-bold text-emerald-400">{money(r.commission)}</Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
