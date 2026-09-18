import "server-only";
import { db } from "./db";
import { PATCHES, isBenignSchemaError } from "./schema-patches.mjs";
import { DELIVERY_PRESETS, allDeliveryMethodValues } from "./category-delivery";

let done: Promise<void> | null = null;

async function apply(): Promise<void> {
  // Cleanup test fields like 'ede' that were created during testing and break UI
  try {
    await db.execute("CREATE TABLE IF NOT EXISTS game_category_images (id TEXT PRIMARY KEY, game_slug TEXT NOT NULL, category_slug TEXT NOT NULL, image TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(game_slug, category_slug))");
  } catch {}
  try {
    await db.execute("DELETE FROM game_offer_fields WHERE field_key LIKE '%ede%' OR label LIKE '%ede%' OR lower(field_key)='gg' OR lower(label)='gg' OR field_key LIKE '%test%' OR lower(field_key)='india' OR lower(label)='india' OR lower(field_key)='abc' OR lower(label)='abc' OR lower(field_key)='aa' OR lower(label)='aa'");
  } catch {}

  // --- Phase 44: per-category delivery presets (Eldorado-style) ---
  // Each category now has only its relevant delivery methods:
  // items: single In-game delivery
  // currency: 7 methods (in-game trade, game pass, auction house, mail trade, island delivery, epic gifting, login method) BETA
  // accounts: Automatic/Manual (fulfilment), no delivery_method list
  // gift-cards: Automatic/Manual, gift card vault
  // top-up: single Top-up
  // subscriptions: Automatic/Manual
  // boosting: manual only, no delivery method
  try {
    for (const [slug, preset] of Object.entries(DELIVERY_PRESETS)) {
      const showDM = preset.showDeliveryMethods ? 1 : 0;
      // fulfilment: both/manual/auto
      await db.execute(
        `UPDATE categories SET
           needs_title=?,
           needs_images=?,
           needs_credentials=?,
           needs_quantity=?,
           allow_volume_discount=?,
           fulfilment=?,
           show_delivery_method=?,
           show_region=0,
           show_platform=0,
           show_login_method=0,
           unit_label=?
         WHERE slug=?`,
        [
          preset.needsTitle ? 1 : 0,
          preset.needsImages ? 1 : 0,
          preset.needsCredentials ? 1 : 0,
          preset.needsQuantity ? 1 : 0,
          preset.allowVolume ? 1 : 0,
          preset.fulfilment,
          showDM,
          preset.unitLabel,
          slug,
        ]
      );
    }
  } catch (e) {
    console.warn("[ensure-schema] preset update failed", e);
  }

  // Seed delivery_time options per user request
  try {
    const times = [
      { value: "instant", label: "Instant" },
      { value: "1_hour", label: "1 hour" },
      { value: "5_hour", label: "5 hour" },
      { value: "12_hour", label: "12 hour" },
      { value: "1_day", label: "1 day" },
      { value: "2_days", label: "2 days" },
      { value: "5_days", label: "5 days" },
      { value: "7_days", label: "7 days" },
      { value: "14_days", label: "14 days" },
    ];
    for (const tm of times) {
      try {
        await db.execute("INSERT OR IGNORE INTO option_lists (id, list_key, value, label, sort_order, active) VALUES (?,?,?,?,?,1)", [`opt_dt_${tm.value}`, "delivery_time", tm.value, tm.label, times.indexOf(tm) * 10]);
      } catch {}
      try {
        await db.execute("UPDATE option_lists SET label=?, active=1 WHERE list_key='delivery_time' AND value=?", [tm.label, tm.value]);
      } catch {}
    }
  } catch {}

  // Seed delivery_method options from presets (all possible values)
  try {
    const methods = allDeliveryMethodValues();
    // add extra generic ones for admin
    const extra: { value: string; label: string }[] = [
      { value: "in_game_delivery", label: "In-game delivery" },
      { value: "top_up", label: "Top-up" },
      { value: "in_game_trade", label: "In-game trade" },
      { value: "game_pass", label: "Game Pass" },
      { value: "auction_house", label: "Auction House" },
      { value: "mail_trade", label: "Mail Trade" },
      { value: "island_delivery", label: "Island Delivery" },
      { value: "epic_gifting", label: "Epic Gifting" },
      { value: "login_method", label: "Login Method" },
    ];
    const merged = new Map<string, string>();
    for (const m of [...methods, ...extra]) merged.set(m.value, m.label);
    let idx = 0;
    for (const [value, label] of merged.entries()) {
      try {
        await db.execute("INSERT OR IGNORE INTO option_lists (id, list_key, value, label, sort_order, active) VALUES (?,?,?,?,?,1)", [`opt_dm_${value}`, "delivery_method", value, label, idx * 10]);
      } catch {}
      try {
        await db.execute("UPDATE option_lists SET label=?, active=1 WHERE list_key='delivery_method' AND value=?", [label, value]);
      } catch {}
      idx++;
    }
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
