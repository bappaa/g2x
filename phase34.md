# Phase 34 — Fix store name change not charging fee (2 free then pay linked)

Build: `✓ Compiled successfully` — only `<img>` warnings.

---

## Bug reported

Seller changed store name from Store Settings many times, but money was never deducted, even after 2 free changes. Expected: 2 free, then pay admin-set fee, linked with buyer panel.

**Root causes found:**

1. **Default fee was 0 when setting missing:**
   - `usernameChangeFee()` in `src/lib/username.ts` returned `0` if `settings.username_change_fee` row didn't exist.
   - Admin Settings form default is $5, but if admin never saved, fee stayed 0 → always free.
   - **Fix:** Return default $5 when row missing, but respect explicit 0 if admin sets fee to 0 to make it free.
   ```ts
   const n = Number(r?.value);
   if (Number.isFinite(n) && n >= 0) return n;
   return 5; // default
   ```

2. **Store name change not always counted as username change:**
   - Old logic only charged if `finalUsername != currentUsername`. If user changed "QuickTopup Store" to "QuickTopup-Store", slug `quicktopup-store` same, username `quicktopup_store` same → `willChangeUsername=false`, no charge, no increment, unlimited free renames.
   - **Fix in `saveStoreAction`:**
     - Now fetches existing `store_name` from DB.
     - `storeNameChanged = existingStoreName.toLowerCase() != newStoreName.toLowerCase()`
     - If store name changed but username would stay same, force a variant username (`_xx` suffix) so username does change and fee logic triggers.
     - Username length now capped to 15 (matches `USERNAME_MAX`) not 20.
     - Ensures `username_changes` increments and fee deducted when store name actually changes.

3. **Double-submit bypass:**
   - `StoreSettings` had no busy guard, could double-click Save and race.
   - Added `busy` ref guard like FinanceView to prevent double submit.

4. **Transaction & linking:**
   - Uses same `users.username_changes` counter as buyer panel, so 2 free total across both panels.
   - Fee deducted via `SPEND_SQL` + `transactions` entry `Store rename to {storeName} (@{username})`.
   - Returns clear error if balance insufficient: "Changing store name changes your username and costs $X..."

---

## Files changed Phase 34

- `src/lib/username.ts` — default fee 5 if setting missing
- `src/lib/actions/seller.ts` — fetch existing store_name, force username change when store name changes, cap username to 15, busy-proof logic
- `src/components/seller/StoreSettings.tsx` — busy ref guard, AtSign info box already shows remaining free changes linked with buyer panel
- `src/app/(site)/seller/store/page.tsx` — already passes username, changesUsed, freeChanges, fee, balance (Phase 32)
- `phase34.md` — this file (only phase doc per rule)

---

## Test after deploy

1. Admin → Settings → set `username_change_fee = 5` (or leave default 5)
2. Seller → Store Settings → change store name 1st time → free, username_changes=1
3. Change again 2nd time → free, changes=2
4. Change 3rd time → should show error if wallet < $5, or deduct $5 and show new username, transaction in Finance → Transaction history as fee
5. Buyer panel → Username card → should show same remaining (0 left) and same fee, linked.

---

## VPS deploy

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build
pm2 restart g2x
```
