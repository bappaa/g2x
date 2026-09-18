import "server-only";
import { db } from "./db";
import { PATCHES, isBenignSchemaError } from "./schema-patches.mjs";

let done: Promise<void> | null = null;

async function apply(): Promise<void> {
  // Cleanup test fields like 'ede' that were created during testing and break UI (image-1, image-3)
  try {
    await db.execute("CREATE TABLE IF NOT EXISTS game_category_images (id TEXT PRIMARY KEY, game_slug TEXT NOT NULL, category_slug TEXT NOT NULL, image TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(game_slug, category_slug))");
  } catch {}
  try {
    await db.execute("DELETE FROM game_offer_fields WHERE field_key LIKE '%ede%' OR label LIKE '%ede%' OR lower(field_key)='gg' OR lower(label)='gg' OR field_key LIKE '%test%' OR lower(field_key)='india' OR lower(label)='india' OR lower(field_key)='abc' OR lower(label)='abc' OR lower(field_key)='aa' OR lower(label)='aa'");
  } catch {}

  // Fix category sell configs for production - per user request: remove region/platform, ensure vault and images show for accounts etc
  try {
    // accounts: needs_title=1, needs_images=1, needs_credentials=1, needs_quantity=0, allow_volume=0, fulfilment=both, show_delivery=1, show_region=0, show_platform=0, show_login=0, unit=account
    await db.execute("UPDATE categories SET needs_title=1, needs_images=1, needs_credentials=1, needs_quantity=0, allow_volume_discount=0, fulfilment='both', show_delivery_method=1, show_region=0, show_platform=0, show_login_method=0, unit_label='account' WHERE slug='accounts'");
    await db.execute("UPDATE categories SET needs_title=0, needs_images=0, needs_credentials=0, needs_quantity=1, allow_volume_discount=0, fulfilment='both', show_delivery_method=1, show_region=0, show_platform=0, show_login_method=0, unit_label='unit' WHERE slug='top-up'");
    await db.execute("UPDATE categories SET needs_title=0, needs_images=0, needs_credentials=0, needs_quantity=1, allow_volume_discount=1, fulfilment='both', show_delivery_method=1, show_region=0, show_platform=0, show_login_method=0, unit_label='unit' WHERE slug='currency'");
    await db.execute("UPDATE categories SET needs_title=0, needs_images=1, needs_credentials=0, needs_quantity=1, allow_volume_discount=0, fulfilment='both', show_delivery_method=1, show_region=0, show_platform=0, show_login_method=0, unit_label='item' WHERE slug='items'");
    await db.execute("UPDATE categories SET needs_title=1, needs_images=0, needs_credentials=0, needs_quantity=0, allow_volume_discount=0, fulfilment='manual', show_delivery_method=0, show_region=0, show_platform=0, show_login_method=0, unit_label='service' WHERE slug='boosting'");
    await db.execute("UPDATE categories SET needs_title=1, needs_images=0, needs_credentials=1, needs_quantity=0, allow_volume_discount=0, fulfilment='both', show_delivery_method=1, show_region=0, show_platform=0, show_login_method=0, unit_label='subscription' WHERE slug='subscriptions'");
    await db.execute("UPDATE categories SET needs_title=1, needs_images=0, needs_credentials=1, needs_quantity=1, allow_volume_discount=0, fulfilment='both', show_delivery_method=1, show_region=0, show_platform=0, show_login_method=0, unit_label='code' WHERE slug='gift-cards'");
  } catch {}

  try {
    await db.execute("DELETE FROM products WHERE lower(name) IN ('aa','all','india','test') OR lower(slug) IN ('aa','all')");
  } catch {}
  try {
    await db.execute("DELETE FROM products WHERE length(name) <= 2 AND name NOT LIKE '%0%' AND name NOT LIKE '%1%' AND name NOT LIKE '%2%' AND name NOT LIKE '%3%' AND name NOT LIKE '%4%' AND name NOT LIKE '%5%' AND name NOT LIKE '%6%' AND name NOT LIKE '%7%' AND name NOT LIKE '%8%' AND name NOT LIKE '%9%'");
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
