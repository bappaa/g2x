# Phase 16 — completion report

Build: `✓ Compiled successfully`. Schema guard verified idempotent. All demo/simulation
data removed from `g2x.db` afterwards.

---

## Fix: dispute raised from My Orders now appears in the message box

**The bug.** There were two separate dispute paths and only one of them touched the chat:

- Dispute opened **from inside a conversation** → wrote the `kind='dispute'` chat message,
  so the red banner appeared. Working.
- Dispute opened **from My Orders → order details → Submit** → wrote only to the
  `disputes` and `dispute_messages` tables. It never inserted a chat message and never
  created a thread, so nothing showed up in Messages at all.

**The fix** (`openDisputeAction` in `src/lib/actions/shop.ts`). It now does what you asked:

1. **Finds or creates the conversation with that seller** — reuses the thread for this
   order, else any existing thread with the same seller, else opens a brand-new one.
   So a buyer who never messaged the seller still gets a conversation created automatically.
2. **Posts the dispute as the first message** in that thread (`kind='dispute'`), which is
   what renders the red highlighted banner from your image — same component, same styling
   as the in-chat path, for buyer *and* seller.
3. Links `threads.dispute_id` ⇄ `disputes.thread_id`, freezes the order and its items,
   notifies the seller into `/seller/messages`, and revalidates both inboxes.
4. **Blocks a second open dispute** on the same order.
5. Returns the thread id, and the order page now **redirects the buyer straight into that
   conversation** instead of leaving them on a page that can't show the banner.

Also added the red **Disputed** badge to the thread list, matching your screenshot.

**Verified end to end** by calling the real action with no pre-existing thread:

| check | result |
|---|---|
| action result | `{ok:true, code:"DSP69929", id:"thr_mtr9xfbvl9wa4c"}` — thread auto-created |
| buyer's message box | "Order disputed by buyer" + reason + **Disputed** badge all render |
| seller's message box | same banner visible |
| seller close button | absent — buyer-only, as intended |
| second dispute attempt | `"There is already an open dispute on this order."` |
| order status | `disputed` |

---

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
  "Order disputed by buyer / Reason: …" banner, files the dispute, and freezes the order.
  Only the buyer can withdraw it → green resolved banner.
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
all pages 200, zero server exceptions.

## Deploy reminder
Git deploys do not migrate the database — run `npm run db:migrate` against Turso on
release. The runtime guard is a safety net, not a replacement.
