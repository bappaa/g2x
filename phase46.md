# Phase 46 — Checkout Per-Game Delivery + Mixed-Category Block + Transaction & Seller Order Fixes

Build: `npx next build` ✓ 87.5kB shared — ESLint clean

## 1. User Requests (Hotfix 6)

- When cart has many things like game currency and items and click Pay Now it goes to pay without needing any details from buyer. Fix that.
- Buyer cannot buy from two separate categories product at a time, they need to remove one; like if they buy from same categories but different game they need to add two details as for the required game/product — wire it up.
- Fix admin panel transaction history not showing.
- Fix bugged seller order panel where sometimes order not showing.
- Keep all previous constraints (commission hidden, store=username, etc).

## 2. Root Causes

**Checkout bypassing delivery details:**
- `CheckoutView.tsx` had single `uid` field for entire cart. If cart contained 2 games (e.g. Genshin + Valorant), only one UID was asked, then reused for both sellers. For accounts/gift-cards it asked UID even though not needed.
- `placeOrderAction` accepted single `uid` and stored it in `orders.delivery_uid`. No per-game validation.
- Razorpay `create-order` and `verify` routes stored `uid` in meta but never validated presence per game, so buyer could pay without entering anything (Razorpay path).
- `getCart()` did NOT return `game_slug`/`game_name`/`product_slug`, so grouping by game was impossible.

**Mixed categories allowed:**
- Cart allowed adding `accounts` + `currency` + `top-up` together. Checkout summed them and created one order with mixed categories, confusing sellers and escrow logic.
- `addToCartAction` had no category check.

**Admin transaction history empty:**
- `adminTransactions` used INNER JOIN users — if user deleted or transaction had no user, row disappeared.
- `placeOrderAction` and `verify` for non-wallet gateways now insert transactions (fixed in Phase45 hotfix4) but admin query still could hide due to join.

**Seller orders sometimes missing:**
- `getSellerOrders` used INNER JOIN users for buyer info — if buyer row missing or email null, order hidden.
- Search used `u.username LIKE` without COALESCE — null username caused filter to miss.
- Ordering only by `o.created_at` could intermix items, pagination count used INNER JOIN same issue.
- No game_slug in result, so UI couldn't show per-game context.

## 3. Fixes

### 3.1 `getCart` — expose game info
`src/lib/queries.ts` `getCart()` UNION now selects:
- `p.game_slug AS game_slug`, `g.name AS game_name`, `p.slug AS product_slug` (both offers and listings branches)
- Enables grouping without extra queries.

### 3.2 Mixed-category block

**`src/lib/actions/shop.ts` `addToCartAction`:**
- After resolving new item's `category_slug` from `products`/`listings`, queries existing cart distinct categories:
```sql
SELECT DISTINCT COALESCE(p.category_slug, l.category_slug) FROM cart_items ...
```
- If existing distinct non-empty and newCategory not in it → return error:
`You have X items in cart. You cannot mix categories — checkout one category at a time. Remove existing items to add Y.`

**`placeOrderAction`:**
- Computes `cats = distinct category_slug` from cart items.
- If `cats.length>1` → error `Mixed categories in cart (a, b) — checkout one category at a time.`
- Same check in Razorpay `create-order` and `verify` routes.

**`CartView.tsx`:**
- Computes `distinctCats`, `isMixed = distinctCats.length>1`
- Shows rose banner when mixed: `Mixed categories: X, Y — you cannot checkout different categories together...`
- Checkout button still works but CheckoutView will block.

### 3.3 Per-game delivery details

**Constants:**
```ts
NO_DETAILS_CATS = ["accounts","gift-cards","giftcards","subscriptions","subscription"]
NEEDS_DETAILS_CATS = ["currency","top-up","items","boosting","game-items","gift-card"] (implicit)
```

**`CheckoutView.tsx` full rewrite:**
- `GameGroup` type: `game_slug, game_name, category_slug, needsDetails, items[]`
- `distinctCats`, `isAccountOnly = every cat in NO_DETAILS_CATS`
- `gameGroups = useMemo` grouping by `game_slug`:
  - `gSlug = it.game_slug || sub split`
  - `needsDetails = !NO_DETAILS_CATS.includes(category_slug)`
- State `deliveryDetails: Record<game_slug, string>` — one input per game that needs it.
- `useEffect` initializes map when groups change.
- UI:
  - If `isMixedCategory` → rose error card with AlertCircle, blocks Pay.
  - Delivery Details section renders per-game card: Gamepad2 icon, game name, item count, category badge, input placeholder `Enter UID / Player ID for {game_name}`.
  - For account-only groups shows note `No delivery details needed for {category}`.
  - Validation `missingDetails = groups.filter(needsDetails && !deliveryDetails[slug].trim())`
  - Pay button disabled if `isBlocked || missingDetails.length>0 || !payable`.
  - `submitWallet` sends `{ paymentMethod, uid: first detail or "", deliveryDetails }`
  - `submitRazorpay` sends same map in body `{ uid, deliveryDetails, note, gateway_code }` and validates before calling create-order.

**`placeOrderAction`:**
- Signature now `form: { paymentMethod, uid, note?, deliveryDetails?: Record<string,string> }`
- Builds `detailsMap` from `form.deliveryDetails` + fallback `singleUid = form.uid.trim()`
- Groups by game_slug (Map).
- If not account-only, iterates groups, requires `detailsMap[gSlug] || singleUid` for each needing details → error if missing `Enter delivery details for {game_name}`.
- `deliveryUidToStore = JSON.stringify(detailsMap)` if >1 game else single value. Stored in `orders.delivery_uid` (TEXT can hold JSON).
- Order insert, `mail.actionRequired` now use `deliveryUidToStore.slice(0,500)` instead of single uid.

**Razorpay routes:**
- `create-order`: same mixed-category + per-game validation, stores `deliveryDetails` in `razorpay_intents.meta` JSON.
- `verify`: parses `deliveryDetails`, validates per game, computes `deliveryUidToStore` JSON, stores in orders, validates stock/self-buy, inserts transaction row (already fixed).

### 3.4 Admin transaction history
`src/lib/queries-admin.ts`:
```ts
SELECT t.*, COALESCE(u.name,'Deleted user') AS name FROM transactions t LEFT JOIN users u ...
```
Changed INNER → LEFT JOIN, so transactions remain visible even if user deleted. Limit 150 ordered DESC.

Also `placeOrderAction` and `verify` already insert `purchase` transactions for all gateways (Phase45 hotfix4), so history now shows Razorpay direct payments.

### 3.5 Seller orders panel
`src/lib/queries.ts`:
- `getSellerOrders` now:
  - LEFT JOIN users (was INNER) → orders visible even if buyer deleted.
  - Search uses `COALESCE(u.username,'') LIKE` + `COALESCE(u.email,'')` + `u.name` for robustness.
  - Selects `o.status AS order_status`, `game_slug` via `COALESCE(p.game_slug,l.game_slug)`, `buyer_name` via `COALESCE('@'||u.username, u.name, '@user_'||substr(...))`
  - Order by `o.created_at DESC, oi.created_at DESC`
- `countSellerOrders` same LEFT JOIN + COALESCE fix.

Result: seller sees all order_items regardless of buyer data, pagination correct, auto-delivered items (status delivered) appear under Delivered tab and under All tab.

### 3.6 CartView type
- `CartRow` now includes `game_slug`, `game_name`, `product_slug` optional to match `getCart` return.

## 4. Files Changed
- `src/lib/queries.ts` — getCart fields, getSellerOrders LEFT JOIN + game_slug, countSellerOrders fix
- `src/lib/queries-admin.ts` — adminTransactions LEFT JOIN
- `src/lib/actions/shop.ts` — addToCart mixed block, placeOrder per-game validation + JSON storage, mail fix
- `src/components/shop/CheckoutView.tsx` — full rewrite: mixed blocker, GameGroup grouping, per-game inputs, validation, Razorpay + wallet flows pass deliveryDetails map
- `src/components/shop/CartView.tsx` — mixed warning banner, distinctCats logic, type extension
- `src/app/api/payments/razorpay/create-order/route.ts` — mixed + per-game validation, stores deliveryDetails in meta
- `src/app/api/payments/razorpay/verify/route.ts` — same validation, JSON delivery_uid, transaction insert preserved
- `phase46.md` — this doc

## 5. Behavior After Fix

- Add currency item (e.g. Genshin) → cart shows it.
- Try to add accounts item → addToCartAction returns error `You have currency items in cart... cannot mix categories`.
- Cart with 2 different games same category (e.g. Genshin currency + Valorant currency):
  - Checkout shows 2 cards: `Genshin Impact — 1 item — currency` input + `Valorant — 1 item — currency` input.
  - Pay disabled until both filled. Error banner lists missing games.
  - Wallet pay stores `{"genshin-impact":"123","valorant":"456"}` in `orders.delivery_uid`.
  - Razorpay same, meta contains map.
- Cart with accounts only → no delivery input, shows `No delivery details needed`, Pay enabled.
- Mixed cart (somehow old data) → CheckoutView shows rose `Mixed categories` blocker, Pay disabled, CartView also shows warning.
- Admin → Transactions → now shows all purchases including Razorpay direct, even if user deleted.
- Seller → Orders → shows all orders, search works on username/email/name, no missing rows due to JOIN.

## 6. Build & Deploy

```bash
cd ~/g2x
npm run build # ✓ 87.5kB shared
npx tsx scripts/deploy-migrate.mts # no new patches, but ensures schema
pm2 restart g2x
```

## 7. Cleanup
- Deleted `phase45.md`, kept `README.md`, `DEPLOYMENT.md`, `phase46.md`
- `public/art` preserved (22 PNGs), `uploads/` transient cleaned, `.next` deletable
- No new env vars, no schema migration needed (delivery_uid TEXT already holds JSON)

## 8. Known Limitations
- delivery_uid as JSON string requires seller UI to parse if needed — currently shows raw JSON in seller Info, acceptable. Future: parse and show per-game mapping nicely.
- Mixed-category block is strict (one category at a time) — user requested this. If they want to buy accounts + currency, they must checkout separately.
- Per-game UID stored as JSON — buyer order view shows JSON; could be improved to pretty list.
