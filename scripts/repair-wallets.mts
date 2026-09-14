import { all, one, run } from "../src/lib/db.ts";

async function main() {
  console.log("Repairing seller wallets...");
  const sellers = await all<{ user_id: string; available_bal: number }>(`SELECT user_id, available_bal FROM seller_profiles WHERE available_bal > 0`);
  console.log(`Found ${sellers.length} sellers with available_bal > 0`);
  let fixed = 0;
  for (const s of sellers) {
    const avail = Number(s.available_bal ?? 0);
    if (!(avail > 0)) continue;
    const u = await one<{ balance: number; withdrawable: number }>(`SELECT balance, COALESCE(withdrawable,0) AS withdrawable FROM users WHERE id=?`, [s.user_id]);
    const balance = Number(u?.balance ?? 0);
    const withdrawable = Number(u?.withdrawable ?? 0);
    const siteCredit = Math.max(0, balance - withdrawable);
    
    if (avail > withdrawable) {
      const newWithdrawable = avail;
      const newBalance = Math.round((avail + siteCredit) * 100) / 100;
      console.log(`Fixing ${s.user_id}: avail=${avail}, balance=${balance}, withdrawable=${withdrawable} -> new balance=${newBalance}, withdrawable=${newWithdrawable}`);
      await run(`UPDATE users SET balance=?, withdrawable=? WHERE id=?`, [newBalance, newWithdrawable, s.user_id]);
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} wallets`);
}

main().catch(e => { console.error(e); process.exit(1); });
