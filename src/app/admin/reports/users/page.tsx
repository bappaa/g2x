import { requireAdmin } from "@/lib/admin";
import { adminUsers, getAdminStats } from "@/lib/queries-admin";
import { AdminPage, Stat, Table, Tr, Td } from "@/components/admin/ui";
import { money, compact } from "@/lib/fmt";
import { Users, UserPlus, Wallet } from "lucide-react";
import LocalTime from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("reports");
  const [s, rows] = await Promise.all([getAdminStats(), adminUsers({ limit: 200 })]);
  const list = (rows as { id: string; name: string; email: string; created_at: string; orders: number; spent: number; balance: number }[])
    .slice()
    .sort((a, b) => Number(b.spent) - Number(a.spent));

  return (
    <AdminPage title="User Report" sub="Signups and your highest-spending customers.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total users" value={compact(Number(s.users?.n ?? 0))} icon={<Users size={13} />} i={0} />
        <Stat label="New today" value={String(Number(s.users?.today ?? 0))} icon={<UserPlus size={13} />} tone="text-emerald-400" i={1} />
        <Stat
          label="Wallet balances held"
          value={money(list.reduce((a, b) => a + Number(b.balance), 0))}
          icon={<Wallet size={13} />}
          i={2}
        />
      </div>
      <Table head={["#", "Customer", "Orders", "Lifetime spend", "Wallet", "Joined"]}>
        {list.slice(0, 30).map((u, i) => (
          <Tr key={u.id}>
            <Td className="muted">{i + 1}</Td>
            <Td>
              <div className="font-semibold">{u.name}</div>
              <div className="text-[10px] muted">{u.email}</div>
            </Td>
            <Td className="muted">{u.orders}</Td>
            <Td className="font-bold">{money(u.spent)}</Td>
            <Td className="muted">{money(u.balance)}</Td>
            <Td className="whitespace-nowrap muted"><LocalTime at={u.created_at} mode="date" /></Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
