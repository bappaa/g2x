import "server-only";
import type { Client, InArgs } from "@libsql/client";
// Pure-fetch HTTP/WS entry point with NO native dependency. Safe in serverless
// and edge runtimes (Netlify, Vercel, Cloudflare) where a .node binary cannot
// be loaded. This is the ONLY statically imported client.
import { createClient as createWebClient } from "@libsql/client/web";

/**
 * Load the Node client lazily, and only for `file:` URLs.
 *
 * `@libsql/client` (the default export) statically imports the native `libsql`
 * addon so it can open local SQLite files. A serverless bundler follows that
 * static import and then fails to ship/dlopen the .node binary, which crashes
 * the function at import time — the whole site returns "Application error: a
 * server-side exception has occurred".
 *
 * Requiring it behind a runtime branch keeps it out of the serverless bundle
 * entirely: on Turso we never reach this line.
 */
function createFileClient(url: string): Client {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports --
     Intentional: a static import would drag the native addon into the
     serverless bundle and crash the function before any code runs. */
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  return createClient({ url });
}

/**
 * Turso / libSQL client.
 *
 * Production:  TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
 *              TURSO_AUTH_TOKEN=<token>
 * Local dev:   falls back to a local SQLite file so the app runs
 *              with zero configuration.
 */

declare global {
  // eslint-disable-next-line no-var
  var __g2xDb: Client | undefined;
}

/** Leftovers from copying .env.example without editing it. */
const PLACEHOLDERS = [
  "your-db-your-org", "your-db", "your-org", "yourdomain",
  "replace-with", "your-turso-token", "<your", "xxx",
];
const isPlaceholder = (v?: string) =>
  !!v && PLACEHOLDERS.some((p) => v.trim().toLowerCase().includes(p));

const LOCAL_DB = "file:./g2x.db";

function make(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  // No URL configured -> local file, zero config.
  if (!url) return createFileClient(LOCAL_DB);

  // Placeholder left in .env.local -> fall back rather than throw a 404.
  if (isPlaceholder(url)) {
    console.warn(
      "\n⚠  TURSO_DATABASE_URL still contains the example placeholder.\n" +
        `   Falling back to the local database (${LOCAL_DB}).\n` +
        "   Comment the line out in .env.local, or set a real Turso URL.\n"
    );
    return createFileClient(LOCAL_DB);
  }

  if (url.startsWith("libsql://") || url.startsWith("https://")) {
    if (!authToken || isPlaceholder(authToken)) {
      console.warn(
        "\n⚠  TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing/placeholder.\n" +
          `   Falling back to the local database (${LOCAL_DB}).\n` +
          "   Create one with: turso db tokens create <your-db>\n"
      );
      return createFileClient(LOCAL_DB);
    }
    /**
     * Remote Turso -> ALWAYS use the web (pure fetch) client.
     *
     * The default "@libsql/client" export resolves to its Node build, which
     * statically imports the native `libsql` addon (a .node binary) to support
     * `file:` URLs. Serverless bundlers (Netlify/Vercel functions) cannot ship
     * or dlopen that binary, so the function throws at import time and every
     * page renders "Application error: a server-side exception has occurred".
     *
     * The /web entry speaks the same Turso HTTP protocol using only `fetch`,
     * so it works identically here and in any serverless runtime.
     */
    return createWebClient({ url, authToken });
  }

  return createFileClient(url);
}

export const db: Client = globalThis.__g2xDb ?? make();
if (process.env.NODE_ENV !== "production") globalThis.__g2xDb = db;

/* ------------------------- tiny query helpers ------------------------- */

/**
 * libSQL returns `Row` objects: array-like instances that carry methods and
 * numeric indices. React Server Components refuse to serialise those to a
 * Client Component ("Only plain objects can be passed…"), so every row is
 * copied into a bare object here. Also normalises BigInt (SQLite INTEGER can
 * come back as BigInt, which JSON/RSC cannot serialise either).
 */
function plain<T>(row: unknown, columns: string[]): T {
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    const v = r[c];
    out[c] = typeof v === "bigint" ? Number(v) : v;
  }
  return out as T;
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  const cols = rs.columns as string[];
  return rs.rows.map((r) => plain<T>(r, cols));
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InArgs = []) {
  return db.execute({ sql, args });
}

export async function tx(statements: { sql: string; args?: InArgs }[]) {
  return db.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write"
  );
}

export const nid = (prefix = "") =>
  prefix +
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 8);

export const nowIso = () => new Date().toISOString();
