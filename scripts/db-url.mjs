/**
 * Shared database-URL resolver for every seeder script.
 *
 * Guards against the most common setup mistake: copying .env.example and
 * leaving the placeholder Turso URL in place. A placeholder (or a libsql://
 * URL with no auth token) silently falls back to the local SQLite file so the
 * app always starts, instead of dying with an opaque "HTTP status 404".
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

/**
 * Returns { url, authToken, mode, note } describing which DB to use.
 * `mode` is "turso" or "local"; `note` is a human-readable warning, if any.
 */
export function resolveDbConfig(env = process.env) {
  const raw = (env.TURSO_DATABASE_URL || "").trim();
  const token = (env.TURSO_AUTH_TOKEN || "").trim();
  const LOCAL = "file:./g2x.db";

  if (!raw) return { url: LOCAL, mode: "local" };

  if (isPlaceholder(raw)) {
    return {
      url: LOCAL,
      mode: "local",
      note:
        "TURSO_DATABASE_URL still contains the example placeholder — using the local file ./g2x.db instead.\n" +
        "  Comment it out in .env.local, or set a real Turso URL to use the cloud.",
    };
  }

  if (raw.startsWith("libsql://") || raw.startsWith("https://")) {
    if (!token || isPlaceholder(token)) {
      return {
        url: LOCAL,
        mode: "local",
        note:
          "TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing or a placeholder — using ./g2x.db instead.\n" +
          "  Run: turso db tokens create <your-db>",
      };
    }
    return { url: raw, authToken: token, mode: "turso" };
  }

  // file:… or anything else libSQL understands locally
  return { url: raw, mode: "local" };
}

/** Builds a libSQL client and prints which database it is talking to. */
export function makeDb(createClient, { quiet = false } = {}) {
  const cfg = resolveDbConfig();
  if (cfg.note && !quiet) console.warn(`\n⚠  ${cfg.note}\n`);
  if (!quiet) {
    console.log(
      cfg.mode === "turso"
        ? `▲ G2X database: ${cfg.url} (Turso cloud)`
        : `▲ G2X database: ${cfg.url} (local file)`
    );
  }
  return cfg.authToken
    ? createClient({ url: cfg.url, authToken: cfg.authToken })
    : createClient({ url: cfg.url });
}
