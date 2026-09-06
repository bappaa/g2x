import { requireUser } from "@/lib/session";
import { getWallet } from "@/lib/queries";
import { Empty, Tag } from "@/components/ui";
import { when, label } from "@/lib/fmt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions — G2X.GG" };

type T = { id: string; type: string; amount: number; reference: string; created_at: string };

import { serverLocale } from "@/lib/locale";

export default async function Page() {
  const { money } = await serverLocale();
  const u = await requireUser();
  const txns = (await getWallet(u.id)) as T[];

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Transactions</h1>
      {txns.length === 0 ? (
        <Empty title="No transactions yet" sub="Wallet top-ups, purchases and refunds appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl panel">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-[var(--line)] text-[11px] muted">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-600/[.05]">
                  <td className="px-4 py-3 font-medium">{t.reference}</td>
                  <td className="px-4 py-3">
                    <Tag tone={t.amount >= 0 ? "green" : "slate"}>{label(t.type)}</Tag>
                  </td>
                  <td className="px-4 py-3 muted">{when(t.created_at)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${t.amount >= 0 ? "text-emerald-400" : ""}`}>
                    {t.amount >= 0 ? "+" : "−"}
                    {money(Math.abs(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
