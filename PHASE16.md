# Phase 16 — completion report

Build: `✓ Compiled successfully`. Schema guard verified idempotent. All demo/simulation
data removed from `g2x.db` afterwards.

## 1–2. Password + usernames
- Password policy is now **6+ characters, no spaces** and nothing else.
- Usernames: 5–15 chars, `A–Z a–z 0–9 _`, case-insensitive uniqueness, reserved
  blocklist, auto-assigned as `<word>_<3 digits>` at signup.
- **2 free renames**, then the wallet is charged `settings.username_change_fee`
  (currently **$5**; set it to `0` to make renames free). Admin's only lever is the price.
- UI: `src/components/dash/UsernameCard.tsx` on Profile — shows remaining free renames,
  the fee, and the wallet balance, and blocks submit when the balance is short.

Verified: `abc` → too short · `waytoolongusername99` → too long · `has space` → no spaces ·
`user@name` → symbols rejected · `admin` → reserved · `Aman_99`, `unicorn_256` → OK.

## 3–4. Chat attachments + in-chat disputes
- Image upload in the message box: 2 MB cap, MIME **and** extension allowlist
  (png/jpeg/webp/gif), stored as a base64 data URI **in the database** (Netlify's disk is
  read-only). Image bubbles open in a full-screen lightbox.
- Buyers can open a dispute from inside the thread; it posts the red
  "Order disputed by buyer / Reason: …" banner (matching your mockup), files the dispute,
  and freezes the order. Only the buyer can withdraw it → green resolved banner.
- Every composer still carries the "monitored by G2X admins" notice.

## 5–6. Escrow: 7-day auto-release, no Confirm Receipt
- The **Confirm Receipt button is gone**. Payout never depends on buyer action.
- The seller marking *Delivered* stamps `delivered_at` and `release_at = +168 h`
  (`settings.escrow_hold_hours`). The buyer sees "Buyer protection active — funds released
  on <date>".
- Netlify has no cron, so `sweepEscrowInBackground()` piggybacks on dashboard/seller page
  renders (single in-flight promise, 60 s throttle).

End-to-end simulation:

| step | result |
|---|---|
| after purchase | seller pending +$9.20, available unchanged |
| seller delivers | `release_at` = +7 days |
| sweep on day 0 | released 0 — correctly held |
| day 8, dispute **open** | released 0 — correctly frozen |
| dispute resolved | released 1 → pending −$9.20, available +$9.20 |
| sweep again | released 0 — **no double payment** |

## 7–9. Reviews, product page
- Reviews are **write-only for buyers**: the star picker + textarea moved onto the order
  detail page, and after submitting they see only a confirmation. Only a `reviewed`
  boolean is sent to the browser — the review text never reaches the buyer's client.
- "My Reviews" and "Disputes" removed from the buyer sidebar.
- Product page buy box now shows the cheapest offer's seller: avatar, store name,
  verified badge, rating % and review count.

## 10. Runtime schema guard
`src/lib/ensure-schema.ts` now also self-repairs the Phase-16 columns
(`users.username/username_changes`, `orders.delivered_at/release_at/released`, the
`messages` attachment/kind/dispute columns, `threads.dispute_id`, `disputes.thread_id`)
plus their indexes. Applies once per process, additive-only, logs but never throws.
Verified: 2 consecutive passes = 0 errors, all 9 columns present.

## Bug found and fixed during verification
Any order whose item had **no image** returned a **500** (`next/image` throws on a null
`src`, which is a server exception, not a broken thumbnail). Since offers snapshot their
image at purchase time, this was reachable with real data.

Fixed with `src/lib/img.ts` — `img()` funnels every dynamic image src through one guard
with a real fallback (`public/art/placeholder.png`). Applied to all **22** dynamic
`<Image>` uses across 18 files. Re-tested with a deliberately image-less order:
all pages 200, zero server exceptions (the previous run logged six).

## Deploy reminder
Git deploys do not migrate the database — run `npm run db:migrate` against Turso on
release. The runtime guard is a safety net, not a replacement.
