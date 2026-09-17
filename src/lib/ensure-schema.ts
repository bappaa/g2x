import "server-only";
import { db } from "./db";
import { PATCHES, isBenignSchemaError } from "./schema-patches.mjs";

let done: Promise<void> | null = null;

async function apply(): Promise<void> {
  // Cleanup test fields like 'ede' that were created during testing and break UI (image-1, image-3)
  try {
    await db.execute("DELETE FROM game_offer_fields WHERE field_key LIKE '%ede%' OR label LIKE '%ede%' OR lower(field_key)='gg' OR lower(label)='gg' OR field_key LIKE '%test%'");
  } catch {}
  for (const sql of PATCHES) {
    try {
      await db.execute(sql);
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      if (isBenignSchemaError(msg)) continue;
      console.warn(`[ensure-schema] skipped: ${sql.slice(0, 60)} — ${msg.slice(0, 120)}`);
    }
  }
}

export function ensureSchema(): Promise<void> {
  if (!done) {
    done = apply().catch(() => {
      done = null;
    }) as Promise<void>;
  }
  return done;
}
