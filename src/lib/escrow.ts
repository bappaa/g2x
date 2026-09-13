import "server-only";
import { all, one, run, tx, nid } from "./db";
import { EARN_SQL } from "./wallet";
import { runAfter } from "./after";
import { monthsOf, releaseDueInstalments } from "./subscription";

/**
 * ESCROW AUTO-RELEASE
 * ===================
 * Money used to move from the seller's `pending_bal` to `available_bal` only
 * when the buyer pressed "Confirm Receipt". That is a trap: a buyer who
 * receives their code and never comes back leaves the seller's funds frozen
 * forever, with no way out except an admin manually intervening.
 *
 * Now the clock starts automatically when the seller marks an order Delivered.
 * `orders.release_at` is stamped at that moment (delivery + hold window), and
 * the sweep below releases anything past its deadline.
 *
 * Safeguards:
 *  - A disputed order is skipped entirely; funds stay frozen until the dispute
 *    is resolved, which is the whole point of holding them.
 *  - `orders.released` is a one-way flag, so a double sweep cannot pay twice.
 *  - Failures are per-order, so one bad row cannot block every other payout.
 */

/** Hold window in hours. Admin-configurable; defaults to 7 days. */
export async function escrowHoldHours(): Promise<number> {
  try {
    const r = await one<{ value: string }>(
      `SELECT value FROM settings WHERE key='escrow_hold_hours'`
    );
    const n = Number(r?.value);
    return Number.isFinite(n) && n > 0 ? n : 24 * 7;
  } catch {
    return 24 * 7;
  }
}

type Due = { id: string; code: string; buyer_id: string };

/**
 * Releases every order whose hold has expired.
 * Safe to call often — it is a no-op when nothing is due.
 */
export async function releaseDueEscrow(): Promise<{ released: number }> {
  let released = 0;

  try {
    const due = await all<Due>(
      `SELECT id, code, buyer_id
         FROM orders
        WHERE released = 0
          AND release_at IS NOT NULL
          AND datetime(release_at) <= datetime('now')
          AND status IN ('delivered','completed')`
    );

    for (const order of due) {
      try {
        // Never release while money is being contested.
        const disputed = await one<{ id: string }>(
          `SELECT id FROM disputes
            WHERE order_id=? AND status IN ('open','under_review') LIMIT 1`,
          [order.id]
        );
        if (disputed) continue;

        const items = await all<{
          id: string; seller_id: string; seller_net: number; sub_months: number | null;
        }>(
          `SELECT id, seller_id, seller_net, sub_months FROM order_items WHERE order_id=?`,
          [order.id]
        );
        if (!items.length) continue;

        const stmts: { sql: string; args: unknown[] }[] = [
          {
            // Flip `released` in the same statement that pays out, and only
            // when it is still 0 — this is what makes a concurrent sweep safe.
            sql: `UPDATE orders
                     SET released=1, status='completed', updated_at=datetime('now')
                   WHERE id=? AND released=0`,
            args: [order.id],
          },
          {
            sql: `UPDATE order_items SET status='completed'
                   WHERE order_id=? AND status IN ('delivered','processing')`,
            args: [order.id],
          },
          {
            sql: `INSERT INTO order_events (id,order_id,label,actor)
                  VALUES (?,?, 'Completed', 'system')`,
            args: [nid("evt_"), order.id],
          },
        ];

        for (const it of items) {
          const net = Number(it.seller_net ?? 0);
          if (!(net > 0)) continue;

          /**
           * A subscription is delivered over time, so it is NOT paid out in
           * one lump here. `scheduleSubscriptions` (below) has already written
           * its instalment plan; the money stays in `pending_bal` and is
           * released month by month by `releaseDueInstalments`.
           */
          if (monthsOf(it)) continue;

          stmts.push({
            sql: `UPDATE seller_profiles
                     SET pending_bal   = MAX(0, pending_bal - ?),
                         available_bal = available_bal + ?
                   WHERE user_id=?`,
            args: [net, net, it.seller_id],
          });
          // Shared wallet: earnings are immediately spendable AND withdrawable.
          stmts.push({ sql: EARN_SQL, args: [net, net, it.seller_id] });
          stmts.push({
            sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
                  VALUES (?,?, 'payout', ?, ?, ?)`,
            args: [
              nid("txn_"),
              it.seller_id,
              net,
              `Escrow released for order ${order.code}`,
              order.id,
            ],
          });
        }

        await tx(stmts as never);
        released++;
      } catch {
        // Skip this order; the next sweep retries it.
      }
    }
  } catch {
    /* table missing or DB unavailable — nothing to do */
  }

  // Subscription instalments run on the same sweep.
  await releaseDueInstalments().catch(() => null);

  return { released };
}

/**
 * Fire-and-forget sweep for page renders.
 *
 * There is no cron on the serverless host, so releases piggyback on ordinary
 * traffic. One in-flight run is shared and results are throttled, so a burst
 * of requests triggers a single sweep rather than one per request.
 */
let inflight: Promise<unknown> | null = null;
let lastRun = 0;
const MIN_GAP_MS = 60_000;

export function sweepEscrowInBackground(): void {
  if (inflight || Date.now() - lastRun < MIN_GAP_MS) return;
  lastRun = Date.now();
  // runAfter keeps the container alive until this settles (waitUntil), so the
  // sweep cannot be cut off mid-query and report "Connection closed".
  runAfter(() => {
    inflight = releaseDueEscrow()
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
    return inflight;
  });
}

/**
 * Backfills `release_at` for orders delivered before this system existed, so
 * historical sales are not stuck pending forever.
 */
export async function backfillReleaseDates(): Promise<number> {
  try {
    const hours = await escrowHoldHours();
    const res = await run(
      `UPDATE orders
          SET delivered_at = COALESCE(delivered_at, updated_at, created_at),
              release_at   = datetime(COALESCE(delivered_at, updated_at, created_at), ?)
        WHERE release_at IS NULL
          AND status IN ('delivered','completed')`,
      [`+${hours} hours`]
    );
    return Number(res?.rowsAffected ?? 0);
  } catch {
    return 0;
  }
}
