import { requireAdmin } from "@/lib/admin";
import { adminWallets } from "@/lib/queries-admin";
import { AdminPage, Table, Tr, Td } from "@/components/admin/ui";
import { money } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("payments");
  const rows = (await adminWallets()) as {
    id: string; name: string; email: string; balance: number;
    available_bal: number; pending_bal: number;
  }[];
  const total = rows.reduce((s, r) => s + Number(r.balance) + Number(r.available_bal) + Number(r.pending_bal), 0);

  return (
    <AdminPage title="Wallets" sub={`Total held on platform: ${money(total)} — buyer credit plus seller escrow.`}>
      <Table head={["Account", "Buyer wallet", "Seller available", "In escrow", "Total"]}>
        {rows.map((w) => (
          <Tr key={w.id}>
            <Td>
              <div className="font-semibold">{w.name}</div>
              <div className="text-[10px] muted">{w.email}</div>
            </Td>
            <Td>{money(w.balance)}</Td>
            <Td className="text-emerald-400">{money(w.available_bal)}</Td>
            <Td className="text-amber-400">{money(w.pending_bal)}</Td>
            <Td className="font-bold">
              {money(Number(w.balance) + Number(w.available_bal) + Number(w.pending_bal))}
            </Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
