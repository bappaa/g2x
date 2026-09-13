import { requireAdmin } from "@/lib/admin";
import { reportTopProducts } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { money } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("reports");
  const rows = (await reportTopProducts(30)) as {
    title: string; orders: number; revenue: number; commission: number;
  }[];
  return (
    <AdminPage title="Product Report" sub="Your best sellers by revenue.">
      <Table head={["#", "Product", "Orders", "Revenue", "Commission"]}>
        {rows.map((r, i) => (
          <Tr key={i}>
            <Td className="muted">{i + 1}</Td>
            <Td className="font-semibold">{r.title}</Td>
            <Td className="muted">{r.orders}</Td>
            <Td className="font-bold">{money(r.revenue)}</Td>
            <Td className="text-emerald-400">{money(r.commission)}</Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
