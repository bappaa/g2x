/**
 * Remove the India-specific hero badge.
 *
 * "INDIA'S #1 GAMING STORE" is CMS content, not code, so it survives deploys
 * and has to be corrected in the database. It also contradicts the standing
 * instruction that nothing on the site should reveal where the business is
 * based. Editable afterwards in Admin -> CMS Blocks -> Hero.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

const REPLACEMENT = "TRUSTED WORLDWIDE · 2,000+ ORDERS THIS WEEK";

async function main() {
  const row = await db.execute(`SELECT data FROM cms_blocks WHERE key='hero'`);
  if (!row.rows.length) {
    console.log("[hero] no hero block found");
    return;
  }
  const raw = String((row.rows[0] as { data: string }).data ?? "[]");
  let items: Record<string, string>[] = [];
  try {
    items = JSON.parse(raw);
  } catch {
    console.log("[hero] hero data is not valid JSON — leaving it alone");
    return;
  }

  let changed = false;
  for (const it of items) {
    if (typeof it.badge === "string" && /india/i.test(it.badge)) {
      console.log(`[hero] "${it.badge}"\n    -> "${REPLACEMENT}"`);
      it.badge = REPLACEMENT;
      changed = true;
    }
  }

  if (!changed) {
    console.log("[hero] nothing to change");
    return;
  }

  await db.execute({
    sql: `UPDATE cms_blocks SET data=? WHERE key='hero'`,
    args: [JSON.stringify(items)],
  });
  console.log("[hero] updated");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
