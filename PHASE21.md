# Phase 21 — new catalog, the "added but not showing" bug, auto/manual delivery

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Verified in a real browser.

---

## 1. The "admin says added, site doesn't show it" bug — found and fixed

**Root cause.** `saveProductAction` inserted into `products` but **never inserted into
`game_categories`**. That table is what decides which games appear under Currency,
Accounts, Items and so on, and every public + seller query reaches products through it.
So the row existed, the admin table listed it, and it was invisible everywhere else.

Reproduced it exactly before fixing:

```
inserting a product in an UNLINKED category: subscriptions
  exists in products table              : 1
  visible via game_categories join      : 0   <-- THE BUG
  game appears in seller wizard         : NO  <-- THE BUG
```

**Fix.** Saving a product now links the game to that category
(`INSERT OR IGNORE INTO game_categories`) and revalidates the seller wizard, the category
page and the game page alongside the admin table.

**Verified end to end in a browser:** created "Valorant Points 1000" under *Currency*
(Valorant was previously only in *Accounts*) → it appeared immediately in the seller
wizard at `/seller/sell/currency/valorant`.

## 2. Fresh database with your product list

New script `npm run db:catalog-new` (`scripts/reseed-catalog.mts`), driven by
`scripts/catalog.json` so you can edit the list without touching code.

| | |
|---|---|
| Games | **169** (deduplicated from 192 entries) |
| Category links | **192** — currency 26, top-up 14, items 115, accounts 37 |
| Products | **0** |
| Field templates | **0** |

Two decisions worth flagging:

- **One game, many categories.** "Roblox" appears in your Top Up, Items *and* Accounts
  lists. It is now a single game linked to all three, not three duplicates — so a seller
  picks "Roblox" once and the category decides the flow.
- **Zero products and zero field templates on purpose.** You said you want to add what
  each product needs yourself. A blank slate is exactly what makes every game different in
  the seller panel; previously they all inherited the same demo templates, which is the
  "every game has the same things" problem you described.

The wipe only touches catalog tables — **users, orders, sellers, wallets and settings are
untouched** (7 users and 2 orders still present after the rebuild).

Each game also gets distinct generated artwork (`/api/gameart/<slug>`): a deterministic
gradient tile with the game's initials, ~500 bytes, cached for a year. Uploading a real
logo in admin overrides it automatically.

## 3. Guaranteed delivery time

Expanded to **16 options** — Instant, 5/10/15/30/45 minutes, 1/2/3/6/12/24 hours,
2/3/5/7 days — and seeded by `npm run db:times`, which is idempotent so the required
dropdown can never end up empty again. Still fully editable in Admin → Dropdown Options.

## 4. Automatic vs Manual delivery (images 1 & 2)

The two modes now render exactly as in your references:

| | **Automatic** | **Manual** |
|---|---|---|
| Credential vault | shown — seller pre-fills login / email / 2FA | hidden |
| Guaranteed Delivery Time | hidden (instant by definition) | shown, required |
| Manual-delivery notes | hidden | shown |

Delivery time is stored as `Instant` for automatic offers, so ranking and buyer-facing
copy stay correct without asking the seller a pointless question.

**Photos are optional** — the card is now labelled "Upload offer photo(s) (Optional)", and
neither the client nor the server ever required an image.

---

## Commands
- `npm run db:catalog-new` — rebuild the catalog from `scripts/catalog.json`
- `npm run db:times` — reseed the delivery-time dropdown

## Deploy
`npm run build` migrates the schema first. To push this catalog to your live Turso
database, run `npm run db:catalog-new` once with `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` set — **it clears the existing catalog**, so run it deliberately.
