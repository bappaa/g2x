/**
 * Pre-flight configuration check.
 *
 *   npm run check:env
 *
 * Verifies every environment variable the app depends on, reports what is
 * missing or obviously wrong, and confirms the database is reachable and
 * migrated. Run this on the server before showing the site to anyone.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";

const PLACEHOLDERS = [
  "your-db-your-org", "your-db", "your-org", "yourdomain",
  "replace-with", "your-turso-token", "<your", "xxx",
];
const isPlaceholder = (v?: string) =>
  !!v && PLACEHOLDERS.some((p) => v.trim().toLowerCase().includes(p));

let fail = 0;
let warn = 0;

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const meh = (m: string) => { warn++; console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const head = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);

const prod = process.env.NODE_ENV === "production";

head("Sessions");
const secret = process.env.AUTH_SECRET?.trim();
if (!secret) bad("AUTH_SECRET is not set — sign-in will not work.");
else if (isPlaceholder(secret)) bad("AUTH_SECRET is still the example placeholder.");
else if (secret.length < 32) meh(`AUTH_SECRET is short (${secret.length} chars). Use 48+ random bytes.`);
else ok("AUTH_SECRET is set.");

head("App URL");
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
if (!appUrl) meh("NEXT_PUBLIC_APP_URL is not set — defaults to http://localhost:3000.");
else if (appUrl.endsWith("/")) meh(`NEXT_PUBLIC_APP_URL has a trailing slash (${appUrl}). Remove it.`);
else if (prod && appUrl.includes("localhost")) bad(`NEXT_PUBLIC_APP_URL is ${appUrl} in production. Set your real domain or every form POST returns 403.`);
else if (prod && !appUrl.startsWith("https://")) meh(`NEXT_PUBLIC_APP_URL is not https (${appUrl}).`);
else ok(`NEXT_PUBLIC_APP_URL = ${appUrl}`);

head("Database");
const url = process.env.TURSO_DATABASE_URL?.trim();
const token = process.env.TURSO_AUTH_TOKEN?.trim();
let dbUrl = "file:./g2x.db";

if (!url) {
  (prod ? meh : ok)(
    prod
      ? "TURSO_DATABASE_URL is not set — using the local SQLite file. Fine for a single VPS, but data lives only on that disk (back it up!)."
      : "No Turso URL set — using the local SQLite file (./g2x.db)."
  );
} else if (isPlaceholder(url)) {
  bad("TURSO_DATABASE_URL is still the example placeholder. Comment it out or set a real URL.");
} else if (!token || isPlaceholder(token)) {
  bad("TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing/placeholder.");
} else {
  dbUrl = url;
  ok(`Turso URL = ${url}`);
}

try {
  // Mirror src/lib/db.ts: remote URLs use the pure-fetch web client.
  const db = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")
    ? createWebClient({ url: dbUrl, authToken: token })
    : createClient({ url: dbUrl });
  const t = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );
  const names = t.rows.map((r) => String(r.name));
  ok(`Connected — ${names.length} tables.`);

  const required = ["users", "products", "offers", "orders", "settings", "cms_blocks", "sessions"];
  const missing = required.filter((n) => !names.includes(n));
  if (missing.length) bad(`Missing tables: ${missing.join(", ")} — run \`npm run db:setup\`.`);
  else ok("Core tables present.");

  const admins = await db.execute(`SELECT COUNT(*) AS n FROM users WHERE role IN ('admin','superadmin')`);
  const n = Number(admins.rows[0]?.n ?? 0);
  if (!n) bad("No admin user exists — run `npm run db:seed`.");
  else ok(`${n} admin user(s).`);
} catch (e) {
  bad(`Cannot reach the database: ${(e as Error).message}`);
}

head("Transactional email");
if (!process.env.RESEND_API_KEY?.trim())
  meh("RESEND_API_KEY not set — emails are logged to the console, not sent.");
else {
  ok("RESEND_API_KEY is set.");
  const d = process.env.MAIL_DOMAIN?.trim();
  if (d) ok(`Sending domain override = ${d}`);
  else meh("MAIL_DOMAIN not set — sending as @g2x.gg. That domain must be verified in Resend or sends will fail.");
}

head("Google OAuth");
if (process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) {
  ok("Google OAuth configured.");
  console.log(`     Redirect URI must be: ${appUrl || "http://localhost:3000"}/api/auth/google?callback=1`);
} else meh("Google OAuth not configured — the Google button signs in a demo account.");

head("KYC storage");
const kyc = process.env.KYC_STORAGE_DIR?.trim();
if (kyc) ok(`KYC_STORAGE_DIR = ${kyc}`);
else meh("KYC_STORAGE_DIR not set — defaults to .private-uploads/ (wiped on redeploy if not persisted).");

console.log(
  `\n${fail ? "\x1b[31m" : warn ? "\x1b[33m" : "\x1b[32m"}` +
  `${fail} error(s), ${warn} warning(s)\x1b[0m\n`
);
process.exit(fail ? 1 : 0);
