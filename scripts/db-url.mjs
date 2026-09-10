/**
 * Shared database resolver for every CLI script.
 *
 * Mirrors src/lib/db.ts so the seeders, migrator and FX refresher always talk
 * to the same database the app does. On the VPS that is a local SQLite file on
 * NVMe; a remote libSQL/Turso URL is still honoured if one is configured.
 *
 * Precedence:
 *   1. TURSO_DATABASE_URL (+ token)  — only if it is a real remote URL
 *   2. DATABASE_PATH / DATABASE_URL  — the VPS file, e.g. /var/lib/g2x/g2x.db
 *   3. ./g2x.db                      — zero-config fallback for a fresh clone
 */

/** Values people leave behind after copying .env.example. */
const PLACEHOLDERS = [
  "your-db-your-org",
  "your-db",
  "your-org",
  "yourdomain",
  "replace-with",
  "your-turso-token",
  "<your",
  "xxx",
];

export function isPlaceholder(value) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return PLACEHOLDERS.some((p) => v.includes(p));
}

/** Normalise a bare path or file: URL into the `file:` form libSQL wants. */
function toFileUrl(raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || isPlaceholder(v)) return null;
  return v.startsWith("file:") ? v : `file:${v}`;
}

/**
 * Returns { url, authToken, mode, note } describing which DB to use.
 * `mode` is "turso" or "local"; `note` is a human-readable warning, if any.
 */
export function resolveDbConfig(env = process.env) {
  const raw = (env.TURSO_DATABASE_URL || "").trim();
  const token = (env.TURSO_AUTH_TOKEN || "").trim();
  const local = toFileUrl(env.DATABASE_PATH) || toFileUrl(env.DATABASE_URL) || "file:./g2x.db";

  // A real remote URL wins, so an existing cloud deployment keeps working.
  if (raw && !isPlaceholder(raw) && (raw.startsWith("libsql://") || raw.startsWith("https://"))) {
    if (!token || isPlaceholder(token)) {
      return {
        url: local,
        mode: "local",
        note:
          "TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing or a placeholder — using the local file instead.",
      };
    }
    return { url: raw, authToken: token, mode: "turso" };
  }

  if (raw && isPlaceholder(raw)) {
    return {
      url: local,
      mode: "local",
      note:
        "TURSO_DATABASE_URL still contains the example placeholder — using the local file instead.\n" +
        "  Remove it from .env.local; on a VPS you want DATABASE_PATH.",
    };
  }

  // file:… path, DATABASE_PATH, or the zero-config default
  return { url: toFileUrl(raw) || local, mode: "local" };
}

/** Builds a libSQL client and prints which database it is talking to. */
export function makeDb(createClient, { quiet = false } = {}) {
  const cfg = resolveDbConfig();
  if (cfg.note && !quiet) console.warn(`\n⚠  ${cfg.note}\n`);
  if (!quiet) {
    console.log(
      cfg.mode === "turso"
        ? `▲ G2X database: ${cfg.url} (remote libSQL)`
        : `▲ G2X database: ${cfg.url} (local file)`
    );
  }
  return cfg.authToken
    ? createClient({ url: cfg.url, authToken: cfg.authToken })
    : createClient({ url: cfg.url });
}
