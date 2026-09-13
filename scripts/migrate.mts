import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

const sql = readFileSync("src/lib/migrations.sql", "utf8");
const stmts = sql
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

let applied = 0;
let skipped = 0;
for (const s of stmts) {
  try {
    await db.execute(s);
    applied++;
  } catch (e) {
    const m = String((e as Error).message);
    if (m.includes("duplicate column") || m.includes("already exists")) skipped++;
    else {
      console.error("FAILED:", s.slice(0, 90), "\n  ", m);
      process.exitCode = 1;
    }
  }
}
console.log(`✓ migration done — ${applied} applied, ${skipped} already present`);

/* ---- seed default admin roles (idempotent) ---- */
const ROLES: [string, string[]][] = [
  ["Super Admin", ["dashboard","users","sellers","verifications","catalog","offers","orders","disputes","messages","payments","withdrawals","promotions","cms","reports","settings","admins"]],
  ["Support Staff", ["dashboard","orders","disputes","messages","users"]],
  ["Seller Manager", ["dashboard","sellers","verifications","offers","catalog"]],
  ["Finance Manager", ["dashboard","payments","withdrawals","reports","orders"]],
  ["Content Manager", ["dashboard","catalog","cms","promotions"]],
];
let roleN = 0;
for (const [name, perms] of ROLES) {
  const ex = await db.execute({ sql: `SELECT id FROM admin_roles WHERE name=?`, args: [name] });
  if (ex.rows.length) continue;
  await db.execute({
    sql: `INSERT INTO admin_roles (id,name,permissions) VALUES (?,?,?)`,
    args: [`rol_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name, JSON.stringify(perms)],
  });
  roleN++;
}
console.log(`✓ admin roles — ${roleN} created, ${ROLES.length - roleN} already present`);
