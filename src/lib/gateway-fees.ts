/* Client-safe gateway types + pure fee math (no DB, no server-only). */

export type GatewayView = {
  code: string;
  name: string;
  logo: string;
  feePercent: number;
  feeFixed: number;
  min: number;
  max: number;
  note: string;
};

/** Fee charged on top of `amount` by this gateway. */
export function feeFor(amount: number, g: GatewayView | null | undefined): number {
  if (!g || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round((amount * (g.feePercent || 0)) / 100 * 100 + (g.feeFixed || 0) * 100) / 100;
}

/** Human message if `amount` falls outside the gateway limits, else null. */
export function limitError(amount: number, g: GatewayView | null | undefined): string | null {
  if (!g) return "Choose a payment method.";
  if (g.min > 0 && amount < g.min) return `${g.name} has a minimum of $${g.min.toFixed(2)}.`;
  if (g.max > 0 && amount > g.max) return `${g.name} has a maximum of $${g.max.toFixed(2)}.`;
  return null;
}
