export const money = (n: number | null | undefined) =>
  "$" +
  Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const compact = (n: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/**
 * IMPORTANT: every formatter below pins an explicit locale AND time zone.
 *
 * Passing `undefined` makes Node fall back to the server's locale (en-GB, UTC)
 * while the browser uses the visitor's (en-US, local tz). The two strings then
 * differ — "06 Sept 2026, 03:04 pm" vs "Sep 06, 2026, 03:04 PM" — and React
 * aborts hydration with "Text content does not match server-rendered HTML".
 * Pinning both makes the server and client render byte-identical output.
 */
const LOCALE = "en-US";
const TZ = "UTC";

export const when = (iso: string) => {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
};

export const day = (iso: string) => {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit", month: "short", year: "numeric", timeZone: TZ,
  });
};

export const ago = (iso: string) => {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const statusTone = (s: string): "brand" | "green" | "amber" | "red" | "slate" => {
  const k = s.toLowerCase().replace(/[\s_]/g, "");
  if (["completed", "delivered", "active", "paid", "approved", "resolved", "published"].includes(k))
    return "green";
  if (["processing", "pending", "pendingpayment", "underreview", "open", "draft"].includes(k))
    return "amber";
  if (["cancelled", "refunded", "disputed", "rejected", "banned", "outofstock", "suspended"].includes(k))
    return "red";
  if (["paused"].includes(k)) return "slate";
  return "brand";
};

export const label = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
