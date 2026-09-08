# Hotfix — "Application error" on the seller New offer page

**Symptom:** `g2x.gg/seller/sell/accounts` returned
*"Application error: a server-side exception has occurred"* on Netlify, while the same
page worked locally.

---

## What was actually wrong

Not a code bug — a **database bug**. I reproduced it exactly by dropping the Phase-19
columns from a local database and hitting the page:

```
LibsqlError: SQLITE_ERROR: no such column: unit_label
    at async (site)/seller/sell/[category]/page.js
```

Phase 19 added nine columns to `categories` (`unit_label`, `needs_credentials`,
`commission_pct`, the notice text, and so on) plus six to `offers`. **Netlify git deploys
do not run migrations**, so the new code shipped while your Turso database still had the
old schema. Every query in the new sell wizard selected columns that did not exist, and
the page threw before it could render.

The runtime schema guard already existed for precisely this situation, but it was only
called from three places — none of them the sell wizard. So nothing repaired the schema
before the query ran.

## The fix — three layers

**1. Repair before reading.** `getSellConfig()` now calls `ensureSchema()` first, which
applies the additive `ALTER TABLE` statements. `createOfferAction()` does the same before
writing. Verified: starting from a database with the columns missing, loading the page
**self-repaired the schema** and rendered correctly.

**2. Never 500 again, even if the repair fails.** If the columns are still absent (an old
read replica, or the database user lacks `ALTER` rights), the query falls back to the
columns that have always existed and serves sensible defaults, inferring the important
ones from the category slug — accounts and subscriptions still get the credential vault,
accounts and boosting still hide volume discounts. The offer `INSERT` has the same
fallback, so a seller's work is never lost to a schema mismatch. A missing column is now a
cosmetic degradation, not a dead page.

**3. Migrate at deploy time.** `npm run build` now runs `scripts/deploy-migrate.mts`
first, which applies the same patch list against `TURSO_DATABASE_URL` *before* any traffic
arrives. It is non-fatal by design: with no database configured it logs and skips, so
preview builds still succeed. Verified against a stripped database:

```
[deploy-migrate] 51 statements: 12 applied, 39 already present, 0 skipped.
```

This is the layer that stops the whole class of problem — future releases migrate
themselves on deploy instead of failing on first use.

## Verified end to end on an unmigrated database

| check | result |
|---|---|
| `/seller/sell` + all 6 category pages | 200, render correctly |
| accounts notice card ("5 Day money hold system") | present |
| credential vault | present |
| create an offer, submit | saved, redirected to My Offers |
| browser console / page errors | none |
| currency path (Roblox → 400 Robux) | "Price per K", 5% fee, correct |
| schema after one page load | all columns restored automatically |

Build: `✓ Compiled successfully`, `tsc --noEmit` clean.

---

## What you need to do

Just redeploy — the build now migrates the database itself. Nothing manual.

If you want to fix it *right now* without waiting for a deploy, run this once against
Turso from your machine:

```bash
TURSO_DATABASE_URL=<your url> TURSO_AUTH_TOKEN=<your token> npm run db:ensure
```

**For the VPS move later:** the same `npm run build` step handles it, so there is nothing
extra to remember. Keep `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set in the build
environment (or point them at whatever database the VPS uses) and migrations apply on
every release.
