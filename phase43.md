# Phase 43 — Seller Delivery Details Optional (remove Code), Delivery Time Options, Fix Duplicate Server Glitch, Bulk Shows Game Fields, Payments Fixed

Build: `npm run build` ✓ 87.5kB shared

---

## Image-1 Seller Orders Delivery Panel
- Shows `Delivery details for the buyer` with `Code` label pre-filled + `Value (code / login / note)` input, Add field, Mark delivered/Cancel
- User: make it optional and remove the code that written there in text area
- Fix: `src/components/seller/SellerOrders.tsx` default `[{ label: "Code", value: "" }]` → `[{ label: "", value: "" }]`, placeholders now `Label (optional)` and `Value (optional - ...)`, so no pre-filled Code. Validation in `deliverOrderAction` already filters empty label/value, so truly optional unless seller wants to add.

## Delivery Time Dropdown (all products same)
- User wants: 1 hour, 5 hour, 12 hour, 1day, 2days, 5 days, 7 days, 14 days
- Fix: `src/lib/ensure-schema.ts` now seeds `option_lists` list_key=delivery_time with 9 values: Instant, 1 hour, 5 hour, 12 hour, 1 day, 2 days, 5 days, 7 days, 14 days (INSERT OR IGNORE + UPDATE label active=1). Also `src/components/admin/BulkProducts.tsx` delivery time select now shows same 9 options (was free text input).
- After VPS `npm run build`, ensureSchema runs and inserts them, so seller add new offer page will show new dropdown.

## Image-2 Buying Page Duplicate Servers
- Top: Game server `India` (from bulk action product.region)
- Bottom: FILTER OFFERS Server `Global` (from Games edit add field)
- Two separates, glitch.
- Fix: `src/components/browse/ProductView.tsx`:
  - Top ChipRow for gameServer now hidden if `gameFields.some(f=>['region','server','game_server'].includes(f.field_key))` — so if admin configured Server via cascading fields, don't show product.region chip
  - Platform Info also hidden if gameFields has platform
  - This removes duplicate, only FILTER OFFERS remains when cascading exists

## Image-3 Bulk Action — Show Game Fields
- User: when we select game, dropdown menu that we added from add field from edit game section should show there, so we can select that
- Fix:
  - `src/app/admin/bulk/page.tsx` now fetches `getAllGameOfferFields` and passes `allFields` to BulkProducts
  - `src/components/admin/BulkProducts.tsx` completely rewritten:
    - Accepts `allFields?: GF[]`
    - Computes `relevantFields` from selected games (union deduped by field_key, filters ede/gg/aa/india/abc test)
    - Shows section `Game Server Fields (from Games → Edit → Add Field)` with Globe icon when game selected, lists each field as `h-11 rounded-xl` select with options from field's JSON
    - On submit, `fieldVals["server"]` → `fd.set("region", ...)`, `fieldVals["region"]` → region, `platform` → platform — so bulk products inherit selected server, fixing duplicate glitch
    - Removed free-text Region/Platform inputs (per earlier request region/platform removed), replaced with note + dynamic fields
    - Delivery time now select with 9 options

## Admin Finance Payments Not Opening
- `src/app/admin/payments/page.tsx` previously `redirect("/admin/transactions")` — caused "not opening" feeling / possible loop
- Fix: Now shows transactions table directly with title Payments, sub "Every payment and transaction — fixed, now opens correctly." No redirect, so finance → Payments opens.

## Seller Panel Full Fix (from Phase42 + this)
- `OfferForm`: vault always shows when `needs_credentials=1` for both auto and manual, with AUTO+EMAIL badge and hint about email automation. Region/Platform removed.
- `EditOfferForm`: same vault fix, manual delivery notes only when !auto
- `ensure-schema.ts` category configs: accounts images=1 credentials=1 quantity=0, currency/top-up images=0 credentials=0, etc — ensures fresh VPS DB has correct sell flow

## Deploy on VPS
```bash
cd ~/g2x
git pull
npm install
npm run build
pm2 restart g2x
```

After deploy, test:
- Seller Orders → Delivery details label empty (no Code)
- Seller Sell → Delivery time shows 1 hour, 5 hour... 14 days
- Buyer product page → only one Server filter (FILTER OFFERS), not two
- Admin Bulk → select BGMI → shows Server dropdown (Global etc) from Games edit
- Admin Finance → Payments opens
