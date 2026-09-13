import { requireUser } from "@/lib/session";
import { getSellerProfile, getWithdrawals, getSellerStats } from "@/lib/queries";
import { all } from "@/lib/db";
import FinanceView from "@/components/seller/FinanceView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance & Payouts — G2X.GG" };

type Prof = { available_bal: number; pending_bal: number; commission_pct: number; payout_method: string | null; payout_detail: string | null };

export default async function Page() {
  const u = await requireUser();
  const [prof, wds, stats, txns] = await Promise.all([
    getSellerProfile(u.id) as Promise<Prof>,
    getWithdrawals(u.id),
    getSellerStats(u.id),
    all(`SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 60`, [u.id]),
  ]);

  return (
    <FinanceView
      available={Number(prof.available_bal)}
      pendingBal={Number(prof.pending_bal)}
      commissionPct={Number(prof.commission_pct)}
      lifetimeNet={Number(stats.totals?.net ?? 0)}
      commissionPaid={Number(stats.totals?.commission ?? 0)}
      payoutMethod={prof.payout_method ?? "Bank Transfer"}
      payoutDetail={prof.payout_detail ?? ""}
      withdrawals={wds as never}
      txns={txns as never}
    />
  );
}
