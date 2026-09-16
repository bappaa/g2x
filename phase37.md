# Phase 37 — Admin panel: Game logos + cascading offer fields (Region → Realm → Faction) → Seller panel

Build: should pass `npm run build` (only `<img>` warnings). No unused imports.

---

## Requirement from images

Image-1: Offer Details → Region dropdown required
Image-2: After selecting Region "NA Season of Discovery", Realm dropdown appears
Image-3: After selecting Realm "Penance", Faction dropdown appears

Admin wants to configure per game:
- Main logo (homepage)
- Product logo (currency/top-up image that appears in product categories)
- Region list that seller can select
- Cascading dropdowns: selecting Region shows Realm options specific to that Region, selecting Realm shows Faction, etc. Many levels.

Seller new offer page should reflect admin-configured fields.

---

## Implementation

### 1. DB — new table `game_offer_fields`

Added to `schema.sql` + `schema-patches.mjs` (85→87 statements):

```sql
CREATE TABLE IF NOT EXISTS game_offer_fields (
  id TEXT PRIMARY KEY,
  game_slug TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE,
  field_key TEXT NOT NULL, -- e.g. region, realm, faction
  label TEXT NOT NULL, -- e.g. Region, Realm, Faction
  field_type TEXT DEFAULT 'dropdown',
  options TEXT, -- JSON: array or object mapping parent_value -> array
  parent_field TEXT, -- field_key of parent that triggers this
  parent_value TEXT, -- specific parent value required (NULL = any)
  sort_order INTEGER DEFAULT 0,
  required INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_game_offer_fields_game ON game_offer_fields(game_slug);
CREATE INDEX idx_game_offer_fields_parent ON game_offer_fields(game_slug, parent_field);
```

This allows:
- Region: parent_field NULL, options ["NA Season of Discovery", "EU..."]
- Realm: parent_field=region, parent_value="NA Season of Discovery", options ["Penance", "Faerlina"]
- Faction: parent_field=realm, parent_value="Penance", options ["Alliance", "Horde"]
- Same field_key with different parent_value allowed (e.g. realm for NA vs EU has different options)

### 2. Queries

`src/lib/queries.ts`:
- `getGameOfferFields(gameSlug)` — cached, for seller wizard
- `getAllGameOfferFields()` — for admin

`src/lib/queries-admin.ts`:
- `adminGameOfferFields(gameSlug)` and `adminAllGameOfferFields()`

### 3. Admin actions

`src/lib/actions/admin.ts`:
- `saveGameOfferFieldAction(form)` — upsert field, parses options as JSON or comma separated, checks duplicate field_key+parent combo
- `deleteGameOfferFieldAction(id)`
- `reorderGameOfferFieldsAction(gameSlug, order)`

### 4. Admin UI

`src/components/admin/GameOfferFieldsEditor.tsx` (new):
- Shows list of fields for a game, sorted by sort_order
- Displays label, field_key, parent condition, required, options preview
- Add/Edit modal with: Label, Field key, Type (dropdown/text/number), Sort order, Options textarea (comma or JSON), Parent field, Parent value, Required checkbox
- Hint explains cascading example
- Delete with confirm

`src/components/admin/GamesManager.tsx`:
- Now accepts `allFields` prop
- `GameForm` now includes `GameOfferFieldsEditor` when editing existing game (shows fields for that slug)
- For new game, shows message "Save first, then edit to configure fields"
- Game logo already required (main logo homepage), product image already required in ProductsManager (currency/top-up logo)

`src/app/admin/games/page.tsx`:
- Fetches `adminAllGameOfferFields()` and passes to GamesManager
- Subtitle updated to mention cascading fields

### 5. Seller side — cascading offer form

`src/app/(site)/seller/sell/[category]/[game]/[product]/page.tsx`:
- Now also fetches `getGameOfferFields(gameSlug)` and passes to OfferForm as `gameFields`

`src/components/seller/OfferForm.tsx`:
- New prop `gameFields?: GameField[]`
- New state `gameVals: Record<string,string>` for dynamic field values
- Helpers:
  - `getGameFieldOptions(f)` — parses JSON, if array returns array, if object and parent_field set, looks up by parent value
  - `isGameFieldVisible(f)` — checks parent_field value exists and if parent_value set, matches
  - `setGameVal(key, val)` — sets value and clears children recursively (when Region changes, Realm and Faction cleared)
  - Syncs region/platform legacy state when key is region/platform
- Validation: checks required game fields that are visible
- Submit: includes `gameVals` as `cf_` fields and overrides region/platform if present
- Rendering:
  - New section "Game-specific cascading fields" renders fields sorted, only if visible, with dropdown or text input
  - If game defines region, hides global region dropdown to avoid duplicate (same for platform)
  - Options fallback: if game field is region and has no options but global regions exist, uses global

Result: Seller flow:
- Select category → Select game → Select product (e.g. WoW Classic Era Gold)
- Offer Details now shows Region dropdown from admin (e.g. NA Season of Discovery)
- Selecting Region triggers Realm dropdown (e.g. Penance) — only shows when parent matches
- Selecting Realm triggers Faction dropdown — cascading as in images
- All values saved as custom_fields and shown on product page

### 6. Product logos

- Game main logo: already required in GamesManager via ImagePicker, shows on homepage
- Product logo (currency/top-up): already required in ProductsManager, hint says "This image shows on game page categories. For currency, upload currency icon"
- Seller product picker already shows product image (currency/top-up logo) — satisfies requirement

---

## Files changed Phase 37

- `src/lib/schema.sql` — game_offer_fields table
- `src/lib/schema-patches.mjs` — +2 patches for game_offer_fields
- `src/lib/queries.ts` — getGameOfferFields, getAllGameOfferFields
- `src/lib/queries-admin.ts` — adminGameOfferFields, adminAllGameOfferFields
- `src/lib/actions/admin.ts` — saveGameOfferFieldAction, deleteGameOfferFieldAction, reorderGameOfferFieldsAction
- `src/components/admin/GameOfferFieldsEditor.tsx` — new editor UI
- `src/components/admin/GamesManager.tsx` — integrate editor, accept allFields
- `src/app/admin/games/page.tsx` — fetch allFields
- `src/app/(site)/seller/sell/[category]/[game]/[product]/page.tsx` — fetch gameFields
- `src/components/seller/OfferForm.tsx` — cascading logic, gameFields rendering, validation, submit
- `src/lib/actions/seller.ts` — fee now deducted from available_bal + wallet (Phase 36 fix retained)
- `src/lib/username.ts` — default fee 5 (Phase 35 retained)
- `phase37.md` — this file (only phase doc per rule)

---

## How to use (admin)

1. Admin → Games → Add game "BGMI" → Upload main logo (homepage) → Save
2. Edit BGMI → scroll to "Offer Details Fields (cascading dropdowns)" → Add field:
   - Label: Region, key: region, options: "NA Season of Discovery, EU Season of Discovery, Global"
   - Required, sort 0
3. Add field: Label: Realm, key: realm, parent_field: region, parent_value: NA Season of Discovery, options: "Penance, Faerlina, Whitemane", sort 1
4. Add field: Label: Faction, key: faction, parent_field: realm, parent_value: Penance, options: "Alliance, Horde", sort 2
5. Save
6. Admin → Products → Add product for BGMI, category Currency, name "1000 Gold", image upload UC/gold icon, region etc → Save
7. Seller → Sell → Currency → BGMI → 1000 Gold → Offer Details now shows Region → Realm → Faction cascading as configured, plus product image in picker

---

## VPS deploy

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build   # ✓ Compiled successfully
pm2 restart g2x
```

All automated, no manual SQL needed — patches apply via deploy-migrate and ensure-schema.

Uploads cleared.
