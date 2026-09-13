import "server-only";
import { db } from "./db";
import { PATCHES, isBenignSchemaError } from "./schema-patches.mjs";

/**
 * RUNTIME SCHEMA GUARD
 * ====================
 * Applies the additive patch list on the first DB-touching request in a
 * process, so a freshly deployed build repairs its own database instead of
 * throwing "no such column".
 *
 * The statements themselves live in `schema-patches.mjs` — plain data, no
 * `server-only` import — so the CLI scripts can apply the exact same list.
 * When the list lived in here, scripts could not read it and a database that
 * had only been seeded + migrated was missing every Phase 19/20 column.
 *
 * Cheap by design: runs once per process, then a cached no-op.
 */

let done: Promise<void> | null = null;

async function apply(): Promise<void> {
  for (const sql of PATCHES) {
    try {
      await db.execute(sql);
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      if (isBenignSchemaError(msg)) continue;
      // Logged, never thrown: a schema-repair failure must not take down a
      // request that might not even need the new column.
      console.warn(`[ensure-schema] skipped: ${sql.slice(0, 60)} — ${msg.slice(0, 120)}`);
    }
  }
}

/**
 * Idempotent, concurrency-safe, once per process.
 * Awaiting this from several requests at once runs the patches a single time.
 */
export function ensureSchema(): Promise<void> {
  if (!done) {
    done = apply().catch(() => {
      // Never cache a rejection — let a later request retry.
      done = null;
    }) as Promise<void>;
  }
  return done;
}
