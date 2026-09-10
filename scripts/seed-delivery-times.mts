/**
 * Guaranteed-delivery-time options.
 *
 * A required dropdown with no rows is an unfillable form, so these are seeded
 * idempotently and re-run safely. Admin can edit them in Dropdown Options.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

const TIMES = [
  "Instant", "5 minutes", "10 minutes", "15 minutes", "30 minutes", "45 minutes",
  "1 hour", "2 hours", "3 hours", "6 hours", "12 hours", "24 hours",
  "2 days", "3 days", "5 days", "7 days",
];

async function main() {
  let i = 0;
  for (const label of TIMES) {
    const value = label.toLowerCase().replace(/\s+/g, "_");
    await db.execute({
      sql: `INSERT INTO option_lists (id,list_key,value,label,sort_order,active)
            VALUES (?, 'delivery_time', ?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET label=excluded.label, sort_order=excluded.sort_order, active=1`,
      args: [`opt_delivery_time_${value}`, value, label, i++],
    });
  }
  const r = await db.execute(
    `SELECT label FROM option_lists WHERE list_key='delivery_time' AND active=1 ORDER BY sort_order`
  );
  console.log(`[delivery-times] ${r.rows.length} options:`,
    (r.rows as { label: string }[]).map((x) => x.label).join(", "));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
