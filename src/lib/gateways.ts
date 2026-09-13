import "server-only";
import { feeFor, limitError, type GatewayView } from "./gateway-fees";
export { feeFor, limitError };
export type { GatewayView };
import { unstable_cache } from "next/cache";
import { all } from "./db";

/**
 * Payment gateways and their fees.
 *
 * Fees are configured once by the admin (Admin → Payment Gateways) and applied
 * everywhere money is taken: wallet top-ups and checkout. The amount actually
 * charged is snapshotted onto the order, so changing a fee later never rewrites
 * historical totals.
 */

export type Gateway = {
  id: string;
  code: string;
  name: string;
  logo: string;
  fee_percent: number;
  fee_fixed: number;
  min_amount: number;
  max_amount: number;
  enabled: number;
  for_topup: number;
  for_checkout: number;
  sort_order: number;
  note: string;
};

/** Plain shape safe to hand to Client Components. */

const toView = (g: Gateway): GatewayView => ({
  code: g.code,
  name: g.name,
  logo: g.logo ?? "",
  feePercent: Number(g.fee_percent) || 0,
  feeFixed: Number(g.fee_fixed) || 0,
  min: Number(g.min_amount) || 0,
  max: Number(g.max_amount) || 0,
  note: g.note ?? "",
});

/** Active gateways for a context. Cached; busted on any gateway write. */
export const getGateways = unstable_cache(
  async (context: "topup" | "checkout"): Promise<GatewayView[]> => {
    const col = context === "topup" ? "for_topup" : "for_checkout";
    const rows = await all<Gateway>(
      `SELECT * FROM payment_gateways
        WHERE enabled=1 AND ${col}=1
        ORDER BY sort_order, name`
    );
    return rows.map(toView);
  },
  ["gateways"],
  { tags: ["gateways"], revalidate: 300 }
);

/** Every gateway, for the admin screen. */
export const allGateways = () =>
  all<Gateway>(`SELECT * FROM payment_gateways ORDER BY sort_order, name`);

/** Look up one gateway by code (uncached — used inside write actions). */
export async function gatewayByCode(code: string): Promise<GatewayView | null> {
  const rows = await all<Gateway>(
    `SELECT * FROM payment_gateways WHERE code=? AND enabled=1 LIMIT 1`,
    [code]
  );
  return rows[0] ? toView(rows[0]) : null;
}

/** Fee for an amount, rounded to cents. Pure — safe on client and server. */

/** Validates an amount against a gateway's limits. Returns an error string or null. */
