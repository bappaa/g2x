# Phase 31 — Fix double withdrawal on seller Finance & Payouts

Build: `npm run build` passes after Phase 30 fixes (Trending icons removed). Only `<img>` warnings remain.

---

## Bug reported (image-1)

Seller taps Withdraw → two identical withdrawals created:
- Two rows "Bank Transfer / ghc · Sep 15, 2026, 02:22 AM · Pending · ₹956.14"
- Same amount, method, detail, timestamp.

**Root cause:**
- `FinanceView.tsx` used `useTransition` but no synchronous re-entry guard. A double click before React re-renders with `pending=true` fires `requestWithdrawalAction` twice.
- Server `requestWithdrawalAction` had no idempotency check — it only limited to 3 pending, but two identical requests within same second both passed.

**Fix client `src/components/seller/FinanceView.tsx`:**
- Added `const busy = useRef(false)` 
- Button onClick now:
```tsx
if (busy.current) return;
busy.current = true;
start(async () => {
  try { ... } finally { busy.current = false; }
})
```
- Prevents second tap in same tick, same pattern used for other actions (deliver, etc).

**Fix server `src/lib/actions/seller.ts` `requestWithdrawalAction`:**
- Added duplicate detection before pending count:
```sql
SELECT id FROM withdrawals 
WHERE seller_id=? AND amount=? AND method=? AND detail=? 
AND created_at >= datetime('now','-60 seconds') LIMIT 1
```
- If found → return error "Duplicate withdrawal detected — please wait a moment."
- This catches race where two requests arrive before first commits.

Result: single withdrawal per tap, even if user double-clicks or network retries.

---

## Phase docs rule

Per user request: remove all previous phase files after each update, keep only latest.
- Deleted `phase30.md`
- Now only `README.md`, `DEPLOYMENT.md`, `phase31.md` exist
- Next update should delete `phase31.md` and create `phase32.md`.

---

## Files changed Phase 31

- `src/components/seller/FinanceView.tsx` — busy ref guard
- `src/lib/actions/seller.ts` — 60s duplicate check in requestWithdrawalAction
- `phase31.md` — this file
- `uploads/` — cleared image-1.png

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
- Seller → Finance & Payouts → Request payout → double-click Withdraw button → only 1 Pending row appears
- Second immediate identical request shows error "Duplicate withdrawal detected"
