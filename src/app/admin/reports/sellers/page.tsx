import { requireAdmin } from "@/lib/admin";
import { reportTopSellers } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { money } from "@/lib/fmt";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("reports");
  const rows = (await reportTopSellers(30)) as {
    store_name: string; rating: number; orders: number; revenue: number; commission: number;
  }[];
  return (
    <AdminPage title="Seller Report" sub="Who is actually moving volume.">
      <Table head={["#", "Store", "Rating", "Orders", "Revenue", "Commission"]}>
        {rows.map((r, i) => (
          <Tr key={i}>
            <Td className="muted">{i + 1}</Td>
            <Td className="font-semibold">{r.store_name ?? "—"}</Td>
            <Td>
              <span className="flex items-center gap-1 text-[11.5px]">
                <Star size={10} className="fill-amber-400 text-amber-400" /> {Number(r.rating ?? 0).toFixed(1)}
              </span>
            </Td>
            <Td className="muted">{r.orders}</Td>
            <Td className="font-bold">{money(r.revenue)}</Td>
            <Td className="text-emerald-400">{money(r.commission)}</Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
