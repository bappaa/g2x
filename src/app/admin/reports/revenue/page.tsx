import { requireAdmin } from "@/lib/admin";
import { adminCommission } from "@/lib/queries-admin";
import { AdminPage, Stat, Table, Tr, Td } from "@/components/admin/ui";
import { money } from "@/lib/fmt";
import { Percent, Wallet, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("reports");
  const rows = await adminCommission();
  const list = rows as { store_name: string; commission_pct: number; orders: number; gross: number; commission: number }[];
  const commission = list.reduce((a, b) => a + Number(b.commission), 0);
  const gross = list.reduce((a, b) => a + Number(b.gross), 0);

  return (
    <AdminPage title="Revenue Report" sub="What G2X itself earns — commission plus checkout fees.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Platform revenue" value={money(commission)} icon={<Percent size={13} />} tone="text-emerald-400" i={0} />
        <Stat label="Gross merchandise value" value={money(gross)} icon={<Wallet size={13} />} i={1} />
        <Stat
          label="Effective take rate"
          value={`${gross ? ((commission / gross) * 100).toFixed(2) : "0.00"}%`}
          icon={<Banknote size={13} />}
          i={2}
        />
      </div>
      <Table head={["Store", "Rate", "Orders", "Gross", "Revenue to G2X"]}>
        {list.map((r, i) => (
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
