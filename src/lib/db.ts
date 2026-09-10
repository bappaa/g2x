import "server-only";
import type { Client, InArgs } from "@libsql/client";

/**
 * DATABASE — local SQLite on the VPS NVMe.
 * ========================================
 * The app used to talk to Turso over HTTP because it ran on Netlify, where
 * there is no persistent disk. On a VPS that indirection is pure cost: every
 * query was a network round-trip to another machine.
 *
 * Reading straight off NVMe turns a ~30-60 ms hop into a ~0.05 ms file read,
 * and removes a whole class of failure (auth tokens, rate limits, and the
 * "Connection closed" errors that came from frozen serverless sockets).
 *
 * Configuration is a single env var:
 *
 *   DATABASE_PATH=/var/lib/g2x/g2x.db      <- recommended on the VPS
 *
 * If it is unset the app falls back to ./g2x.db so a fresh clone runs with no
 * configuration at all. `TURSO_DATABASE_URL` is still honoured if present, so
 * an existing remote deployment keeps working without edits.
 */

declare global {
  // eslint-disable-next-line no-var
  var __g2xDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __g2xDbTuned: boolean | undefined;
}

/** Leftovers from copying .env.example without editing it. */
const PLACEHOLDERS = [
  "your-db-your-org", "your-db", "your-org", "yourdomain",
  "replace-with", "your-turso-token", "<your", "xxx",
];
const isPlaceholder = (v?: string) =>
  !!v && PLACEHOLDERS.some((p) => v.trim().toLowerCase().includes(p));

/**
 * Resolve the database location.
 *
 * Accepts a bare path (/var/lib/g2x/g2x.db) or a file: URL, and normalises to
 * the `file:` form libSQL expects.
 */
function resolveLocalUrl(): string {
  const raw = process.env.DATABASE_PATH?.trim() || process.env.DATABASE_URL?.trim();
  if (!raw || isPlaceholder(raw)) return "file:./g2x.db";
  if (raw.startsWith("file:")) return raw;
  return `file:${raw}`;
}

/**
 * Node client. Statically required (not imported) so bundlers that follow
 * static imports do not try to trace the native addon into an edge bundle.
 */
function createFileClient(url: string): Client {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports --
     Kept as require() so the native binding is resolved at runtime only. */
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  return createClient({ url });
}

function make(): Client {
  const turso = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();

  // Still support a remote libSQL/Turso URL if one is explicitly configured.
  if (turso && !isPlaceholder(turso) && /^(libsql|https):\/\//.test(turso)) {
    if (!token || isPlaceholder(token)) {
      console.warn(
        "\n⚠  TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing/placeholder.\n" +
          "   Falling back to the local database.\n"
      );
      return createFileClient(resolveLocalUrl());
    }
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { createClient } = require("@libsql/client/web") as typeof import("@libsql/client/web");
    return createClient({ url: turso, authToken: token });
  }

  return createFileClient(resolveLocalUrl());
}

export const db: Client = globalThis.__g2xDb ?? make();
// Reuse one client across hot reloads AND across the production process, so we
// never open a second connection to the same file.
globalThis.__g2xDb = db;

/**
 * SQLite pragmas that matter for a web app on NVMe.
 *
 * Applied once per process, fire-and-forget so a cold request is never blocked:
 *
 *   journal_mode=WAL   readers no longer block the writer (the single biggest
 *                      win — the default rollback journal serialises everything)
 *   synchronous=NORMAL fsync on checkpoint rather than every commit; safe under
 *                      WAL and dramatically faster on writes
 *   busy_timeout       wait for a lock instead of instantly throwing SQLITE_BUSY
 *   foreign_keys       enforce the constraints the schema declares
 *   cache_size=-64000  64 MB page cache (negative = KiB)
 *   temp_store=MEMORY  sorts and temp tables in RAM
 */
function tune(): void {
  if (globalThis.__g2xDbTuned) return;
  globalThis.__g2xDbTuned = true;

  const pragmas = [
    "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = NORMAL",
    "PRAGMA busy_timeout = 5000",
    "PRAGMA foreign_keys = ON",
    "PRAGMA cache_size = -64000",
    "PRAGMA temp_store = MEMORY",
  ];

  void (async () => {
    for (const p of pragmas) {
      try {
        await db.execute(p);
      } catch {
        /* remote libSQL ignores some pragmas — never fatal */
      }
    }
  })();
}
tune();

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

/**
 * Transient failures worth one retry.
 *
 * On a local file the realistic case is SQLITE_BUSY: another request holds the
 * write lock. `busy_timeout` handles most of it, and this catches the rest.
 * (The network cases are kept for the remote-libSQL fallback path.)
 */
function isTransient(e: unknown): boolean {
  const m = String((e as Error)?.message ?? "").toLowerCase();
  return (
    m.includes("database is locked") ||
    m.includes("sqlite_busy") ||
    m.includes("busy") ||
    m.includes("connection closed") ||
    m.includes("stream closed") ||
    m.includes("socket hang up") ||
    m.includes("econnreset") ||
    m.includes("fetch failed") ||
    m.includes("network")
  );
}

async function exec(sql: string, args: InArgs) {
  try {
    return await db.execute({ sql, args });
  } catch (e) {
    if (!isTransient(e)) throw e;
    await new Promise((r) => setTimeout(r, 120));
    return db.execute({ sql, args });
  }
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T[]> {
  const rs = await exec(sql, args);
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
  return exec(sql, args);
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
