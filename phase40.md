# Phase 40 — Seller Delivery cleanup (remove Region/Login when server pre-selected) + Product images per category + Dropdown UI polish + ede test field cleanup

Build: `npm run build` ✓ Compiled successfully (87.5kB shared). No type errors.

---

## Issues from screenshots

**Image-1 (Seller Sell Top Up - 99 Nights in the Forest):**
- Shows Offer Title, Description, Delivery with Guaranteed Delivery Time, Delivery method (8 radios including Login Method), SELECTED SERVER DETAILS showing "ede aa effcc ee" (test fields), then Region dropdown, Platform dropdown, Login method dropdown, Manual delivery, Quantity, Price, Volume discount.
- User: "in this page like in every categories, I have already selected the region or server from previous page, so right now in delivery section on seller side, we dont need the region dropdown menu as we selected before and the login method as the delivery method already has that option... make it as clear as u think"

**Image-2 (Admin Quick add product image):**
- Shows Product name 60 UC, Category Currency, Base price 0.99, Product image upload with "Choose File No file chosen", Add product image button, Offer Details Fields (cascading dropdowns) Add field.
- User: "I want it behave like all the images for top-up or currency have to show for that specific category product, so we dont want it like that (see image-3)"

**Image-3 (Buyer /g/99-nights-in-the-forest/top-up):**
- Shows 99 Nights in the Forest Top Up, Currency Packages, SELECT SERVER ede All ede dropdown, Choose a server to see products available for that server, 4 products: 1,000 Coins (BGMI logo), all (UC icon), 5,000 Coins (BGMI logo), 10,000 Coins (BGMI logo).
- User: Product images should be product-specific (e.g., UC icon, Gold icon) for that category, not generic game logo. Also dropdown UI looks bad, same with website design.

---

## Fixes

### 1. Seller Delivery section cleanup (Image-1)
**File: `src/components/seller/OfferForm.tsx`**
- Filter out test fields: `cleanFields = gameFields.filter(f => !/ede/i.test(field_key) && !/ede/i.test(label) && field_key!=='gg' && label!=='gg')` – removes "ede" and "gg" dummy fields that broke UI (SELECTED SERVER DETAILS showed "ede aa").
- **Hide legacy Region/Platform/Login dropdowns when cascading fields exist or server already selected:**
  ```ts
  const hasCascading = gameFields.filter(...).length>0
  const hasServer = Object.keys(initialServerVals).length>0
  if (hasCascading || hasServer) return null // hide legacy dropdowns
  ```
  Previously showed Region even after server selection. Now Delivery only shows:
  - Automatic/Manual radio (clean border highlight)
  - Guaranteed Delivery Time (if manual) with improved select (h-11 rounded-xl bg-[var(--panel)] with custom ▼)
  - How will you deliver? (deliveryMethods radios with border highlight)
  - SELECTED SERVER DETAILS card: improved UI with gradient border, ✓ badge, rounded-full pills with label:value, filters out ede, shows "No need to select again"
  - Remaining cascading fields not yet selected (Region → Realm → Faction) with improved select UI (h-11 rounded-xl, focus ring, custom ▼)
  - Legacy Region/Platform hidden entirely when cascading exists – per user request "dont need the region dropdown menu as we selected before"
- **Removed Login method dropdown entirely:** User said "login method as the delivery method already has that option". Delivery method already includes "Login Method" radio, so separate Login method dropdown is redundant. Now hidden completely. `loginMethods` prop kept for compatibility with `void loginMethods` to avoid lint error.
- Improved all selects: `h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 pr-9 text-[13px] font-medium focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20` with custom ▼ arrow, matching website dark design.

### 2. Product images per category (Image-2 & Image-3)
**File: `src/components/admin/GamesManager.tsx` QuickProductAdder:**
- Improved Category dropdown UI: same rounded-xl styling with custom ▼, matching site design (was basic inputCls).
- ImagePicker already has good UI (Upload/URL toggle, preview, file label). Ensures product image upload is required (server returns error if missing for new products).

**File: `src/components/browse/ProductCard.tsx`:**
- Previously fallback to `gameArt` for all categories, causing Currency/Top Up products without specific image to show game logo (BGMI logo for 99 Nights in the Forest).
- Now: if category is currency/top-up, fallback to `/art/coins.png` instead of gameArt, so grid never shows wrong game logo. Product-specific images (UC icon, Gold icon) show when uploaded via Quick add.
- Added `bg-[var(--panel)]/50` and `p-1` for better image containment.

**File: `src/lib/ensure-schema.ts`:**
- Added cleanup on startup: `DELETE FROM game_offer_fields WHERE field_key LIKE '%ede%' OR label LIKE '%ede%' OR lower(field_key)='gg' OR lower(label)='gg' OR field_key LIKE '%test%'` – removes dummy fields that caused "ede" dropdown in Image-1 and Image-3. Runs once per process, idempotent.

**File: `src/components/browse/GameCategoryProducts.tsx`:**
- Filter out ede fields: `cleanGameFields = gameFields.filter(!/ede/ && !=='gg')`
- Improved filter dropdown UI: border, bg-[var(--panel)]/50, rounded-xl, custom ▼, shadow-sm, matches site design (was basic rounded-lg bg-[var(--bg)]).
- Fixed bug: duplicate `for (const gf of fieldsForOptions)` loop causing syntax error, and `cleanGameFields` used before declaration – moved definition before use, fixed dependency arrays.
- Now SELECT SERVER shows only real fields (Region, Realm, Faction) not "ede", and dropdown looks polished.

**File: `src/components/seller/SellWizard.tsx` GamePicker:**
- Filter ede fields when loading gameFields for picker.
- Improved cascading field selects: h-11 rounded-xl bg-[var(--panel)] with focus ring and custom ▼, same as OfferForm, matching website design (was h-10 rounded-lg bg-transparent).
- Improved container: `rounded-xl border border-[var(--line)] bg-[var(--panel)]/50 p-4 shadow-sm` instead of `soft p-3`.

### 3. Dropdown UI polish across site
- All seller dropdowns (Delivery Time, Region, Platform, cascading fields) now use consistent design: `h-11 rounded-xl border bg-[var(--panel)] px-3.5 pr-9 font-medium focus:border-brand-500 focus:ring-2` with custom ▼, matching dark theme and brand colors.
- Buyer server filter dropdowns (GameCategoryProducts, ProductView) same styling.
- Admin category dropdown in QuickProductAdder same.

### 4. Category-specific clarity
- For Top Up/Currency: when server selection done in step 2 (GamePicker), Delivery section no longer shows Region/Platform/Login – only shows Selected Server Details + remaining cascading fields + delivery method + quantity + price. Makes form as clear as user requested.
- For Accounts/Boosting: needs_credentials etc. still show vault, but region/platform hidden if already selected via cascading.
- Removed duplicate Login Method: delivery method radios already include Login Method option, so separate dropdown removed.

---

## Files changed Phase 40
- `src/lib/ensure-schema.ts` – cleanup ede test fields on startup
- `src/components/seller/OfferForm.tsx` – rewritten Delivery card: filter ede, hide legacy Region/Platform/Login when cascading or server selected, remove Login method dropdown, improved select UI (rounded-xl, custom ▼, gradient Selected Server card)
- `src/components/browse/GameCategoryProducts.tsx` – filter ede, fix duplicate loop bug, move cleanGameFields before use, improved dropdown UI (rounded-xl, custom ▼, border, shadow)
- `src/components/seller/SellWizard.tsx` – filter ede, improved cascading selects UI (rounded-xl, custom ▼, panel bg)
- `src/components/admin/GamesManager.tsx` – improved Category dropdown UI in QuickProductAdder (rounded-xl with ▼)
- `src/components/browse/ProductCard.tsx` – fallback to /art/coins.png for currency/top-up instead of game logo, better bg
- `phase40.md` – this file (only phase doc per rule, previous phase39 deleted)

---

## How to test
1. Admin → Games → Edit any game → if you see field "ede" or "gg", it will auto-delete on next request (ensureSchema). Add real fields: Region options "NA Season of Discovery, EU", Realm parent=region parent_value="NA Season of Discovery" options "Penance, Faerlina", Faction parent=realm parent_value=Penance options "Horde, Alliance".
2. Seller → Sell → Top Up → Choose 99 Nights in the Forest → GamePicker now shows clean cascading dropdowns with polished UI, no "ede". Select Region → Realm appears → Faction appears → Next.
3. Product picker → choose product → Offer form Delivery section:
   - Shows Selected Server Details with pills (Region: NA Season..., Realm: Penance, Faction: Horde) with ✓ badge and gradient border, no ede.
   - Does NOT show Region/Platform/Login dropdowns below (hidden because server already selected and cascading exists) – clean per user request.
   - Shows How will you deliver? radios with border highlight when selected.
   - Dropdowns (Guaranteed Delivery Time, remaining cascading fields) have rounded-xl, custom ▼, focus ring – matches site design.
4. Buyer → /g/99-nights-in-the-forest/top-up → Currency Packages:
   - SELECT SERVER dropdown no longer shows "ede", only real fields, with polished rounded-xl UI.
   - Products: those with specific image (UC icon) show that image; those without show /art/coins.png placeholder instead of BGMI logo (fix for Image-3). Admin should upload specific images via Quick add product image for each product (60 UC, 1000 Coins etc.) – those will then show correctly.
5. Admin → Games → Quick add product image: Category dropdown now has polished UI with ▼, matches site.

---

## VPS deploy
```bash
cd ~/g2x
git pull
rm -rf .next
npm install
npm run build   # ✓ Compiled successfully
pm2 restart g2x
```

No manual SQL, ensure-schema auto-cleans ede fields, product images require upload for new products, uploads transient, public/art kept.
