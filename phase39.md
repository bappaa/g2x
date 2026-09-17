# Phase 39 — Fix CSP build break + Wallet fee not deducting from available_bal + Game cascading fields verified

Build: `npm run build` ✓ Compiled successfully (87.5kB shared). tsc --skipLibCheck ✓ No errors.

---

## Issues fixed

### 1. Build break after CSP fix (reported by user)
```
./src/components/dash/ProfileForm.tsx
Error: x Unexpected token div. Expected jsx identifier
  59 |   };
  60 |   return (
> 61 |     <div
```
Same for `SecurityView.tsx:17` and `StoreSettings.tsx:64`.

**Root cause:** Bulk conversion `action={(fd)=>{` → `onSubmit={(e)=>{ e.preventDefault(); const fd = new FormData(...); {` left extra `{` from original arrow body. Closing was only `}}` instead of `}}}` or removal, causing function to close early and JSX outside function — SWC parse error. tsc didn't catch, Next SWC did.

**Fix:**
- Rewrote `ProfileForm.tsx`, `SecurityView.tsx`, `StoreSettings.tsx` with clean `handleSubmit(e: FormEvent)` pattern: `const handleSubmit = (e)=>{ e.preventDefault(); const fd = new FormData(e.currentTarget); start(async()=>{...}) }` and `<form onSubmit={handleSubmit}>`, no inline double braces.
- Fixed `MarkRead.tsx` double `}}` introduced by earlier brace patch: `onClick={() => start(...)) }}` → single `}`.
- Verified all other converted files (`CategoriesManager`, `ProductsManager`, `GamesManager`, `GameOfferFieldsEditor`, `ListingsView`, `BecomeSeller`, `AuthForm`, `BuyerKyc`) have correct `}}` closing.
- Result: `npm run build` now passes.

### 2. Wallet fee bug (Phase 36)
User: "fee deducted in history but not wallet balance – must deduct from available_bal. Only deduct fee from available balance (seller earnings) – fix both balances."

**Root cause:**
- `seller.ts` `saveStoreAction` did `available_bal = available_bal - fee` + `SPEND_SQL` which is `balance = balance - ?, withdrawable = MIN(withdrawable, MAX(0, balance - ?))`. If user had siteCredit (topped-up money), SPEND_SQL preserved withdrawable and took fee from siteCredit, while available_bal decreased → mismatch, withdrawal still blocked, wallet showed wrong.
- `auth.ts` `changeUsernameAction` only used SPEND_SQL, never touched `seller_profiles.available_bal`, so seller who changed username via buyer panel had transaction history -fee but available_bal unchanged.

**Fix:**
- Added `FEE_SQL` in `src/lib/wallet.ts`:
```sql
UPDATE users SET balance = balance - ?, withdrawable = MAX(0, COALESCE(withdrawable,0) - ?) WHERE id=?
```
This always deducts from withdrawable (seller earnings), not preserving it.

- `seller.ts`: replaced SPEND_SQL with FEE_SQL for store rename fee. Keeps `available_bal = available_bal - fee` in seller_profiles update + FEE_SQL for users. Transaction now deducts from both.

- `auth.ts`: replaced SPEND_SQL with FEE_SQL + added `UPDATE seller_profiles SET available_bal = MAX(0, available_bal - ?) WHERE user_id=?` so buyer panel rename also hits available_bal if user is seller. Fee now truly comes from earnings.

- Both paths: check `balance < fee` and `available_bal < fee` before allowing rename, so fee cannot be paid from siteCredit alone.

### 3. Admin games cascading offer fields (Phase 37) verified
Requirement: main logo for homepage, product logo (currency/top-up like UC) for product categories; Offer Details allow adding Region options, then child dropdown from selected Region (Realm), child can have names, then new dropdown after that (Faction), arbitrary depth, automated, reflected on seller panel `seller/sell/[category]/[game]/[product]` as cascading dropdowns like image-1 Region required, image-2 Realm appears after Region=NA Season of Discovery, image-3 Faction appears after Realm=Penance.

**Already implemented in Phase 38:**
- `GamesManager.tsx` shows Game logo (homepage) + QuickProductAdder for product image (currency/top-up) with category picker.
- `GameOfferFieldsEditor.tsx` allows adding fields with `field_key`, `label`, `options` (comma or JSON), `parent_field`, `parent_value`, `required`, `sort_order`. Example: Region options "NA Season of Discovery, EU...", Realm parent_field=region parent_value="NA Season of Discovery" options "Penance, Faerlina", Faction parent_field=realm parent_value=Penance options "Horde, Alliance".
- `SellWizard.tsx` GamePicker: after picking game, loads its fields, shows cascading dropdowns, clears children on parent change, validates required, builds query `?region=...&realm=...&faction=...` and navigates.
- `ProductPicker` carries serverParams to product links.
- `OfferForm.tsx`: accepts `initialServerVals`, shows summary card "Selected Server Details", hides pre-selected fields from Delivery section (region removed), validates cascading required, saves all as `cf_` + region/platform overrides.
- `GameCategoryProducts.tsx` + `ProductView.tsx`: buyer side filters like Eldorado — top Region/Realm/Faction dropdowns, filteredOffers, offer cards show custom_fields badges.

No further code needed, verified working after build fix.

---

## Files changed Phase 39
- `src/lib/wallet.ts` – added FEE_SQL that deducts from withdrawable directly
- `src/lib/actions/auth.ts` – import FEE_SQL, deduct fee from users.balance+withdrawable AND seller_profiles.available_bal
- `src/lib/actions/seller.ts` – import FEE_SQL, use FEE_SQL instead of SPEND_SQL for store rename fee, keeps available_bal deduction
- `src/components/dash/ProfileForm.tsx` – rewritten clean handleSubmit, fixes build
- `src/components/dash/SecurityView.tsx` – rewritten clean handleSubmit, fixes build
- `src/components/seller/StoreSettings.tsx` – rewritten clean handleSubmit with file upload handling, fixes build + double brace
- `src/components/dash/MarkRead.tsx` – fixed double }}
- `phase39.md` – this file (only phase doc per rule, previous phase38 deleted)

---

## How to test fee fix
1. Create seller with earnings: place order as buyer, deliver as seller, wait escrow or admin release → available_bal increases, wallet withdrawable increases.
2. Note balances: Dashboard → Wallet shows Balance and Withdrawable, Seller → Store shows available.
3. Go to Seller → Store Settings → change store name (3rd change, after 2 free). Fee = admin setting `username_change_fee` (e.g., $2).
4. Submit. Check:
   - Transaction history shows -fee with reference "Store rename..."
   - Wallet Balance decreased by fee
   - Withdrawable decreased by fee
   - Seller available_bal decreased by fee (Seller → Finance → Available)
5. Same via Buyer → Profile → change username (3rd time) – should also deduct from available_bal if user is seller.
6. If user has siteCredit (topped-up) but low available_bal, rename should fail with "available balance is $X" error, not take from siteCredit.

## How to test cascading fields
1. Admin → Games → Edit WoW Classic → Offer Details Fields → Add Region key=region label=Region options="NA Season of Discovery, EU Season of Discovery" required, sort 0
2. Add Realm key=realm label=Realm parent_field=region parent_value="NA Season of Discovery" options="Penance, Faerlina" required sort 1
3. Add Faction key=faction label=Faction parent_field=realm parent_value=Penance options="Horde, Alliance" sort 2
4. Seller → Sell → Currency → WoW Classic → picker shows Region dropdown (required), select NA Season of Discovery → Realm appears, select Penance → Faction appears, select Horde → Next enabled
5. Product list → pick Gold → Offer form shows summary "Selected Server Details: Region NA Season of Discovery, Realm Penance, Faction Horde" and Delivery section has no Region selector
6. Place offer, buyer → /g/wow-classic/currency → filters Region/Realm/Faction work like Eldorado.

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

No manual SQL, ensure-schema handles new columns, FEE_SQL is code-only, uploads transient, public/art kept.
