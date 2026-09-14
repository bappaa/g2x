import "server-only";
import { one } from "./db";

/**
 * ONE WALLET, TWO RIGHTS
 * ======================
 * A seller is also a buyer, so there is a single spendable balance
 * (`users.balance`) used at checkout — no transfers, no second wallet to top up.
 *
 * But not every dollar in it may leave the platform. `users.withdrawable`
 * tracks the portion that came from **seller earnings**:
 *
 *     balance       = topped-up money + seller earnings   (all spendable)
 *     withdrawable  = seller earnings only                (cashable to a bank)
 *
 * Money added by card/UPI/crypto raises `balance` but NOT `withdrawable`, so a
 * card top-up can never be cashed out to a bank account. That closes an obvious
 * money-laundering hole and matches the rule the client asked for: "if they add
 * money from the buyer panel, that money they can't withdraw".
 *
 * Spending draws from the non-withdrawable part first, so a seller's cashable
 * earnings survive as long as possible.
 */

export type WalletView = {
  /** Total spendable at checkout. */
  balance: number;
  /** Subset of `balance` that may be withdrawn to a bank. */
  withdrawable: number;
  /** Topped-up money: spendable on the site, never cashable. */
  siteCredit: number;
};

export async function getWallet(userId: string): Promise<WalletView> {
  const u = await one<{ balance: number; withdrawable: number }>(
    `SELECT balance, COALESCE(withdrawable,0) AS withdrawable FROM users WHERE id=?`,
    [userId]
  ).catch(() => null);

  const balance = Number(u?.balance ?? 0);
  // Clamp: withdrawable can never exceed what is actually in the wallet.
  const withdrawable = Math.max(0, Math.min(Number(u?.withdrawable ?? 0), balance));
  return {
    balance,
    withdrawable,
    siteCredit: Math.round((balance - withdrawable) * 100) / 100,
  };
}

/**
 * Repairs a seller wallet that got out of sync due to an old bug where
 * `seller_profiles.available_bal` was increased without crediting
 * `users.withdrawable` (buyer confirm, dispute win, withdrawal reject).
 *
 * The fix is safe: it only ever INCREASES withdrawable/balance to match
 * available_bal, never decreases, and preserves existing siteCredit (topped-up
 * money). After repair, `min(available_bal, withdrawable)` equals
 * `available_bal`, so withdrawal works.
 */
export async function repairSellerWallet(userId: string): Promise<WalletView> {
  try {
    const { one: oneDb, run } = await import("./db");
    const prof = await oneDb<{ available_bal: number }>(
      `SELECT available_bal FROM seller_profiles WHERE user_id=?`,
      [userId]
    ).catch(() => null);
    const avail = Number(prof?.available_bal ?? 0);
    if (!(avail > 0)) return getWallet(userId);

    const u = await oneDb<{ balance: number; withdrawable: number }>(
      `SELECT balance, COALESCE(withdrawable,0) AS withdrawable FROM users WHERE id=?`,
      [userId]
    ).catch(() => null);
    const balance = Number(u?.balance ?? 0);
    const withdrawable = Math.max(0, Math.min(Number(u?.withdrawable ?? 0), balance));
    const siteCredit = Math.round((balance - withdrawable) * 100) / 100;

    if (avail > withdrawable) {
      const newWithdrawable = avail;
      const newBalance = Math.round((avail + siteCredit) * 100) / 100;
      await run(
        `UPDATE users SET balance=?, withdrawable=? WHERE id=?`,
        [newBalance, newWithdrawable, userId]
      ).catch(() => null);
      return { balance: newBalance, withdrawable: newWithdrawable, siteCredit };
    }
    return { balance, withdrawable, siteCredit };
  } catch {
    return getWallet(userId);
  }
}

/**
 * SQL for spending `?` from a wallet.
 *
 * Both columns fall together, but `withdrawable` only drops once the
 * non-withdrawable credit is exhausted:
 *
 *     new_withdrawable = min(old_withdrawable, new_balance)
 *
 * Cheap, atomic, and impossible to get out of step with `balance`.
 * Bind the amount twice.
 */
export const SPEND_SQL = `
  UPDATE users
     SET balance = balance - ?,
         withdrawable = MIN(COALESCE(withdrawable,0), MAX(0, balance - ?))
   WHERE id=?`;

/** Args helper for SPEND_SQL. */
export const spendArgs = (amount: number, userId: string) => [amount, amount, userId];

/**
 * SQL for crediting seller earnings — raises both numbers, because this money
 * is genuinely the seller's to withdraw. Bind the amount twice.
 */
export const EARN_SQL = `
  UPDATE users
     SET balance = balance + ?,
         withdrawable = COALESCE(withdrawable,0) + ?
   WHERE id=?`;

export const earnArgs = (amount: number, userId: string) => [amount, amount, userId];

/**
 * SQL for a top-up or refund — spendable, but NOT withdrawable.
 * Bind the amount once.
 */
export const CREDIT_SQL = `UPDATE users SET balance = balance + ? WHERE id=?`;

/**
 * SQL for moving money out to a bank. Reduces both, and the WHERE clause is the
 * real guard: the row only updates when the user genuinely has that much
 * withdrawable, so a race cannot overdraw. Check `rowsAffected`.
 * Bind: amount, amount, userId, amount.
 */
export const WITHDRAW_SQL = `
  UPDATE users
     SET balance = balance - ?,
         withdrawable = COALESCE(withdrawable,0) - ?
   WHERE id=? AND COALESCE(withdrawable,0) >= ?`;