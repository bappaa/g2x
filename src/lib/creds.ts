/**
 * Delivered-credential helpers (shared by buyer + seller views).
 *
 * Sellers save credentials as `[{ label, value }, …]`, but older rows (and the
 * seed data) used a flat `{ key: value }` object. Both shapes must render, so
 * everything is normalised to a single list here. This is what fixed the
 * "Objects are not valid as a React child (found: object with keys
 * {label, value})" crash on the Reveal button.
 */

export type Cred = { label: string; value: string };

export function parseCreds(json: string | null | undefined): Cred[] {
  if (!json) return [];

  let data: unknown;
  try {
    data = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    // Not JSON at all — treat the whole string as one delivered code.
    return String(json).trim() ? [{ label: "Code", value: String(json).trim() }] : [];
  }

  if (Array.isArray(data)) {
    return data
      .map((row): Cred => {
        if (row && typeof row === "object") {
          const r = row as Record<string, unknown>;
          return {
            label: String(r.label ?? r.key ?? r.name ?? "Value"),
            value: stringify(r.value ?? r.val ?? r.code ?? ""),
          };
        }
        return { label: "Code", value: stringify(row) };
      })
      .filter((c) => c.value !== "");
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: stringify(v) }))
      .filter((c) => c.value !== "");
  }

  const s = stringify(data);
  return s ? [{ label: "Code", value: s }] : [];
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

/** Copy text, with a fallback for insecure origins where clipboard API is absent. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Whole-credential-set text, used by the "Copy all" button. */
export const credsToText = (creds: Cred[]) =>
  creds.map((c) => `${c.label}: ${c.value}`).join("\n");
