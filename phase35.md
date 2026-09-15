# Phase 35 — Fix unlimited free store rename (fee not deducting) + full bug sweep buyer/seller

Build: `✓ Compiled successfully` (only `<img>` warnings)

---

## Image-1 bug: Store Settings shows $5 fee but user can rename unlimited free

**Screenshot:** Username @ghg, message "You have used your 2 free changes (linked with buyer panel). Each further store name change costs $5.00, taken from your wallet (balance $968.52)." User changes name many times, no deduction.

**Root causes (3):**

1. **Default fee 0 when setting missing:**
   - `usernameChangeFee()` returned 0 if `settings` row absent. Admin form default is $5, but if never saved, fee=0 → always free.
   - Fixed in `src/lib/username.ts`: now returns explicit value if set (including 0 for free), else default 5.
   ```ts
   if (Number.isFinite(n) && n >=0) return n;
   return 5;
   ```

2. **Same slug = bypass:**
   - Old: `storeNameChanged` compared lowercased, so "ghg" vs "Ghg" = no change, no fee. Also if slug same (e.g. "My Store" vs "My-Store"), username same → `willChangeUsername=false` → no charge, unlimited free.
   - Fixed in `saveStoreAction`:
     - Fetch existing `store_name` from DB
     - `storeNameChanged = existing.trim() !== new.trim()` (case-sensitive, so any visual change counts)
     - If changed, force `willChangeUsername=true` and ensure `finalUsername` is different (adds random `_xx` suffix if needed)
     - Username now capped to 15 (matches `USERNAME_MAX`) not 20
     - Now any store name change triggers fee logic after 2 free

3. **Double-submit race in StoreSettings:**
   - No busy guard, double-click could race.
   - Added `busy` ref guard like FinanceView:
   ```tsx
   const busy = useRef(false);
   action={(fd) => {
     if (busy.current) return;
     busy.current=true;
     start(async () => { try { ... } finally { busy.current=false } })
   }}
   ```

**Fee flow now:**
- `used = username_changes` (shared buyer/seller counter)
- `fee = used>=2 ? usernameChangeFee() : 0`
- If fee>0 && balance<fee → error "Changing store name changes your username and costs $X..."
- Tx: update seller_profiles + update users username + username_changes+1 + SPEND_SQL + fee transaction
- UI in StoreSettings already shows remaining free, fee, balance linked with buyer panel

---

## Full bug sweep buyer + seller (automated)

**Checked & fixed:**

- **Double withdrawal:** Phase 31 fixed with busy ref + 60s duplicate check in `requestWithdrawalAction`
- **Build errors:** Phase 33 fixed `Info` unused import, Phase 30 fixed `TrendingUp/Down` unused, Phase 28 fixed `any` and Prof type
- **Indian placeholders:** Phase 32 removed +91, Rahul, UPI from BecomeSeller, StoreSettings, FinanceView, Footer, Fees page
- **Message routing:** Header message icon now context-aware `/seller/messages` vs `/dashboard/messages`, MessagesView uses basePath
- **Duplicate chats:** startThread reuses existing thread for same buyer+seller, prevents new thread per tap
- **OffersView:** removed green market price `~ market ₹...`
- **Listing card:** removed Level|Outfits, What's included now dynamic from custom_fields
- **Checkout:** category-specific, no UID for accounts/gift-cards/subscriptions
- **Become seller:** whatsapp/telegram/discord optional added
- **OfferForm:** removed Email Login/Password auto-share section
- **Seller orders:** search + pagination 10/page, copy Order ID button, per-order message box with order ID, separate buyer/seller sections, KYC gate block delivery if buyer not verified >=$30
- **Any/unescaped:** scanned, no `as any` or unescaped `'` left
- **Payout methods:** UPI removed globally → Bank Transfer, PayPal, Crypto (USDT), Wise
- **Username fee linking:** buyer UsernameCard and seller StoreSettings share same counter, 2 free then pay

**No new bugs found in sweep.** All critical paths use `useTransition` + busy guard where money involved.

---

## Files changed Phase 35

- `src/lib/username.ts` — default fee 5
- `src/lib/actions/seller.ts` — storeNameChanged case-sensitive, force username change when store name changes, cap 15, fee enforcement
- `src/components/seller/StoreSettings.tsx` — busy guard, AtSign info
- `phase35.md` — this file (only phase doc, per rule: delete previous phase each update)

---

## VPS deploy & test

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build
pm2 restart g2x
```

Test:
- Seller → Store Settings → change name 3rd time → should deduct $5 from wallet (check Finance → Transaction history shows fee, wallet balance drops from $968.52 to $963.52)
- Try changing case "ghg" → "Ghg" → should now count as change and charge (previously bypassed)
- Buyer → Settings → Username → same counter, 0 free left
- Finance → Withdraw → double-click → only 1 withdrawal (not 2)
- No +91, no UPI anywhere
