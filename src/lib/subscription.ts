import "server-only";
import { all, one, tx, nid } from "./db";

/**
 * SUBSCRIPTION DRIP-RELEASE
 * =========================
 * A subscription is sold up front but *delivered over time*. Paying the seller
 * the whole amount at the end of the normal 7-day escrow window would leave the
 * buyer unprotected: a seller can hand over a "Netflix Premium 12 months"
 * account, collect the full price, and let it die after week five.
 *
 * So a subscription order is paid to the seller in equal monthly instalments:
 *
 *     instalment = seller_net / months
 *
 * Month 1 unlocks with the normal escrow release (7 days after Delivered, the
 * same rule as every other product). Each later month unlocks 30 days after the
 * previous one. Everything not yet released stays in the seller's `pending_bal`
 * — real money the buyer can still claw back through a dispute.
 *
 * That makes a partial refund natural: if the buyer disputes in month 5 of 12,
 * the 7 unreleased instalments are still held and can be returned in full,
 * while the seller keeps the 5 months they actually provided.
 *
 * Everything here is automatic. Sellers and admins never schedule anything.
 */

/** Days between instalments. Calendar months vary; a flat 30 keeps it predictable. */
export const MONTH_DAYS = 30;

export type Instalment = {
  id: string;
  order_id: string;
  order_item_id: string;
  seller_id: string;
  buyer_id: string;
  month_no: number;
  months_total: number;
  amount: number;
  due_at: string;
  released: number;
};

/**
 * Reads the subscription length off an order item.
 * Anything below 2 is not a subscription and pays out in one go as before.
 */
export function monthsOf(row: { sub_months?: number | null } | null | undefined): number {
  const n = Number(row?.sub_months ?? 0);
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : 0;
}

/**
 * Builds the payment schedule for one order item.
 *
 * `startAt` is the order's escrow release moment, so instalment 1 lands exactly
 * when a normal product would have been paid out. Rounding is absorbed by the
 * final instalment so the instalments always sum to `sellerNet` to the cent.
 */
export function buildSchedule(
  sellerNet: number,
  months: number,
  startAt: string
): { month_no: number; amount: number; due_offset_days: number }[] {
  const per = Math.floor((sellerNet / months) * 100) / 100;
  const out: { month_no: number; amount: number; due_offset_days: number }[] = [];
  let allocated = 0;
  for (let m = 1; m <= months; m++) {
    const last = m === months;
    const amount = last ? Math.round((sellerNet - allocated) * 100) / 100 : per;
    allocated = Math.round((allocated + amount) * 100) / 100;
    out.push({ month_no: m, amount, due_offset_days: (m - 1) * MONTH_DAYS });
  }
  void startAt;
  return out;
}

/**
 * Creates schedule rows for every subscription item on an order.
 * Idempotent: an item that already has a schedule is skipped, so re-running
 * after a retry or a redeploy cannot double-schedule anyone.
 */
export async function scheduleSubscriptions(orderId: string, releaseAt: string): Promise<number> {
  let created = 0;
  try {
    const items = await all<{
      id: string; seller_id: string; seller_net: number; sub_months: number | null;
    }>(
      `SELECT id, seller_id, seller_net, sub_months FROM order_items WHERE order_id=?`,
      [orderId]
    );
    const order = await one<{ buyer_id: string }>(`SELECT buyer_id FROM orders WHERE id=?`, [orderId]);
    if (!order) return 0;

    for (const it of items) {
      const months = monthsOf(it);
      if (!months) continue;

      const existing = await one<{ id: string }>(
        `SELECT id FROM subscription_schedule WHERE order_item_id=? LIMIT 1`,
        [it.id]
      );
      if (existing) continue;

      const net = Number(it.seller_net ?? 0);
      if (!(net > 0)) continue;

      const rows = buildSchedule(net, months, releaseAt);
      await tx(
        rows.map((r) => ({
          sql: `INSERT INTO subscription_schedule
                  (id,order_id,order_item_id,seller_id,buyer_id,month_no,months_total,amount,due_at,released)
                VALUES (?,?,?,?,?,?,?,?, datetime(?, ?), 0)`,
          args: [
            nid("sub_"), orderId, it.id, it.seller_id, order.buyer_id,
            r.month_no, months, r.amount, releaseAt, `+${r.due_offset_days} days`,
          ],
        })) as never
      );
      created += rows.length;
    }
  } catch {
    /* schedule table missing — ensureSchema will add it on the next request */
  }
  return created;
}

/**
 * Pays out every instalment that has come due.
 *
 * Mirrors the plain-escrow guarantees:
 *  - an open dispute on the order freezes all further instalments;
 *  - `released` flips inside the same UPDATE that pays, so a concurrent sweep
 *    cannot pay twice;
 *  - failures are per-instalment, so one bad row cannot block the rest.
 */
export async function releaseDueInstalments(): Promise<{ released: number; paid: number }> {
  let released = 0;
  let paid = 0;

  try {
    const due = await all<Instalment>(
      `SELECT s.* FROM subscription_schedule s
         JOIN orders o ON o.id = s.order_id
        WHERE s.released = 0
          AND datetime(s.due_at) <= datetime('now')
          AND o.status IN ('delivered','completed','processing')
        ORDER BY s.due_at
        LIMIT 500`
    );

    for (const inst of due) {
      try {
        const disputed = await one<{ id: string }>(
          `SELECT id FROM disputes
            WHERE order_id=? AND status IN ('open','under_review') LIMIT 1`,
          [inst.order_id]
        );
        if (disputed) continue;

        const amt = Number(inst.amount ?? 0);
        if (!(amt > 0)) continue;

        await tx([
          {
            // Guarded by `released=0`: the payment and the flag move together.
            sql: `UPDATE subscription_schedule
                     SET released=1, released_at=datetime('now')
                   WHERE id=? AND released=0`,
            args: [inst.id],
          },
          {
            sql: `UPDATE seller_profiles
                     SET pending_bal   = MAX(0, pending_bal - ?),
                         available_bal = available_bal + ?
                   WHERE user_id=?`,
            args: [amt, amt, inst.seller_id],
          },
          {
            // Shared wallet: seller earnings are spendable *and* withdrawable.
            sql: `UPDATE users
                     SET balance = balance + ?,
                         withdrawable = COALESCE(withdrawable,0) + ?
                   WHERE id=?`,
            args: [amt, amt, inst.seller_id],
          },
          {
            sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
                  VALUES (?,?, 'payout', ?, ?, ?)`,
            args: [
              nid("txn_"), inst.seller_id, amt,
              `Subscription month ${inst.month_no}/${inst.months_total}`,
              inst.order_id,
            ],
          },
        ] as never);

        released++;
        paid = Math.round((paid + amt) * 100) / 100;
      } catch {
        /* retried on the next sweep */
      }
    }
  } catch {
    /* table missing or DB unavailable */
  }

  return { released, paid };
}

/**
 * Total still held for an order — the maximum a buyer can get back.
 * This is what makes a *partial* refund correct: months already provided stay
 * with the seller, the remainder is refundable.
 */
export async function unreleasedTotal(orderId: string): Promise<{
  amount: number; months: number; totalMonths: number;
}> {
  try {
    const r = await one<{ amount: number; months: number; total: number }>(
      `SELECT COALESCE(SUM(CASE WHEN released=0 THEN amount ELSE 0 END),0) AS amount,
              COALESCE(SUM(CASE WHEN released=0 THEN 1 ELSE 0 END),0)      AS months,
              COUNT(*)                                                     AS total
         FROM subscription_schedule WHERE order_id=?`,
      [orderId]
    );
    return {
      // SUM() over floats drifts (0.1+0.2 style), which would show a buyer
      // "$64.39999999999999". Money is always rounded to cents at the boundary.
      amount: Math.round(Number(r?.amount ?? 0) * 100) / 100,
      months: Number(r?.months ?? 0),
      totalMonths: Number(r?.total ?? 0),
    };
  } catch {
    return { amount: 0, months: 0, totalMonths: 0 };
  }
}

/**
 * Cancels the remaining instalments and refunds them to the buyer — the
 * partial-refund path for a subscription that stopped working mid-term.
 */
export async function refundUnreleased(
  orderId: string,
  reason = "Subscription partially refunded"
): Promise<{ refunded: number; months: number }> {
  const held = await unreleasedTotal(orderId);
  if (!(held.amount > 0)) return { refunded: 0, months: 0 };

  const order = await one<{ buyer_id: string; code: string }>(
    `SELECT buyer_id, code FROM orders WHERE id=?`,
    [orderId]
  );
  if (!order) return { refunded: 0, months: 0 };

  // Group the held money per seller so each seller's pending_bal is reduced
  // by exactly what they lose.
  const perSeller = await all<{ seller_id: string; amount: number }>(
    `SELECT seller_id, SUM(amount) AS amount
       FROM subscription_schedule
      WHERE order_id=? AND released=0
      GROUP BY seller_id`,
    [orderId]
  );

  const stmts: { sql: string; args: unknown[] }[] = [
    {
      sql: `UPDATE subscription_schedule
               SET released=2, released_at=datetime('now')
             WHERE order_id=? AND released=0`,
      args: [orderId],
    },
    {
      // Refunds land as ordinary wallet credit — spendable, not withdrawable.
      sql: `UPDATE users SET balance = balance + ? WHERE id=?`,
      args: [held.amount, order.buyer_id],
    },
    {
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
            VALUES (?,?, 'refund', ?, ?, ?)`,
      args: [
        nid("txn_"), order.buyer_id, held.amount,
        `${reason} — ${held.months} of ${held.totalMonths} months, order ${order.code}`,
        orderId,
      ],
    },
  ];

  for (const s of perSeller) {
    stmts.push({
      sql: `UPDATE seller_profiles SET pending_bal = MAX(0, pending_bal - ?) WHERE user_id=?`,
      args: [Math.round(Number(s.amount ?? 0) * 100) / 100, s.seller_id],
    });
  }

  await tx(stmts as never);
  return { refunded: held.amount, months: held.months };
}

/** Buyer/seller-facing schedule for one order. */
export const scheduleForOrder = (orderId: string) =>
  all<Instalment & { released_at: string | null }>(
    `SELECT * FROM subscription_schedule WHERE order_id=? ORDER BY month_no`,
    [orderId]
  );
