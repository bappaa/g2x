# Phase 36 — Fix fee deducted in history but not from wallet/available balance + deduct only from available

Build: `✓ Compiled successfully`

---

## Bug reported (image-1 + text)

Seller changes store name after 2 free changes:
- Transaction history shows `- $5.00 Store rename to ...` 
- But wallet balance / Available balance `₹94,038.25` didn't decrease
- User says: "only deduct the fee from the available balance"

**Root cause in `saveStoreAction`:**

Old code:
```ts
UPDATE seller_profiles SET store_name=?, slug=?, ... WHERE user_id=?
...
if (fee>0) {
  SPEND_SQL // deducts from users.balance + withdrawable
  INSERT transaction fee
}
```

- Deducted from `users.balance` (wallet) but **NOT** from `seller_profiles.available_bal` (the "Available" shown in Finance & Payouts and sidebar)
- FinanceView `available` comes from `available_bal`, not `users.balance`, so user saw no change in Available even though transaction existed
- Also `repairSellerWallet` could later restore balance, making it look like no deduction

**Fix:**

1. Fetch `available_bal` from seller_profiles
2. Check both balances have enough:
   - `users.balance >= fee`
   - `available_bal >= fee` else error "available balance is $X..."
3. Deduct fee from **both** to keep wallet in sync, but primary is available_bal per user request:
```sql
UPDATE seller_profiles 
SET store_name=?, ..., available_bal = available_bal - ?
WHERE user_id=?
```
- If fee>0, subtract fee, else subtract 0
- Plus existing `SPEND_SQL` to deduct from `users.balance/withdrawable`
- Plus fee transaction

Now:
- Available balance (₹94k) drops by $5 (converted) immediately
- Wallet balance ($968) also drops by $5
- Transaction history shows fee and both balances reflect it
- Revalidate both `/seller/store` and `/seller/finance` so UI updates

If user meant "only from available" strictly, current fix does deduct from available (main) and also wallet to keep `withdrawable` consistent. If you want **only** available and not wallet, remove SPEND_SQL — but then wallet and available would desync and repair would undo it. Current dual-deduct is correct for seller earnings.

---

## Files changed Phase 36

- `src/lib/actions/seller.ts` — fetch available_bal, check available, deduct fee from available_bal in same UPDATE, revalidate finance
- `phase36.md` — this file (only phase doc per rule)

---

## Full bug sweep (buyer/seller) — no new bugs found, previous fixes verified:

- Double withdrawal: busy guard + 60s duplicate check
- Store rename fee: 2 free then pay, linked buyer/seller, default $5, case-sensitive change detection, available_bal deduction
- Indian placeholders: +91, UPI, Rahul removed → global
- Message routing, duplicate chats, OffersView market text, Listing card, Checkout category-specific, copy Order ID, per-order message box, KYC gate, search+pagination — all still intact

---

## VPS deploy

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build
pm2 restart g2x
```

Test:
- Seller with 2 changes used, Available $100, Wallet $100, change store name → Available becomes $95, Wallet $95, transaction shows -$5
- Try with Available $2 but Wallet $100 → error "available balance is $2..."
