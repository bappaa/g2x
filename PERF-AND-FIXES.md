# Performance pass + dark-mode dropdown + production "Connection closed"

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Verified in a real browser.

---

## 1. The slowness — measured, not guessed

I instrumented the database layer and timed every page. The SQL was never the
problem (12 ms for the heaviest query). Two things were:

### a) `/seller/offers` was shipping 1.46 MB of HTML

This is the page the **"+ New offer"** button lives on, which is exactly where you felt
the lag. Two causes:

1. **All 927 catalog products were embedded in the page** on every load — purely so the
   edit modal could filter them client-side. The modal never shows more than 40 rows.
   It now queries `/api/seller/catalog` as you type (debounced 220 ms).
2. **All 184 offers were rendered at once** — ~900 KB of markup. Now paginated at 30 per
   page with a pager that preserves your status and category filters.

### b) The site shell ran a 5-stage query waterfall

`getSessionUser` → footer/menu → counters → search index → FX rates, each stage waiting
for the previous one. Locally that is invisible; against Turso every stage is a network
round-trip, so the shell cost ~5 RTTs *before the page itself started*. They are all
independent, so they now run together.

### c) The search index was 45 KB on every page

The header search embedded the whole games+products index into every page's HTML, for a
box most visitors never open. It is now fetched from `/api/search` on first keystroke,
cached 5 minutes at the edge.

### Results

| Page | Before | After |
|---|---|---|
| `/seller/offers` | **1458 KB / 315 ms** | **296 KB / 47 ms** |
| `/seller/sell/accounts` | 175 KB / 50 ms | 128 KB / 26 ms |
| `/dashboard` | 179 KB / 36 ms | 133 KB / 30 ms |
| `/` (home) | 264 KB / 50 ms | 218 KB / 43 ms |
| `/seller` | 174 KB / 31 ms | 127 KB / 28 ms |

The offers page is **~5x smaller and ~6.7x faster**, and every page on the site lost
~46 KB. The gain is much larger on Netlify than these local numbers suggest, because
there each saved round-trip is real network latency, not a 1 ms local file read.

Also cached the sell-wizard queries (`getSellGames`, `getSellProducts`, option lists) and
collapsed the offer form's **five** separate dropdown queries into one.

## 2. Dark-mode dropdowns (image-1)

The `<select>` popup is drawn by the operating system, not by CSS — you cannot style the
open list. The page never declared `color-scheme`, so the OS assumed light and painted a
white popup with our light-grey text on it: unreadable, exactly as in your screenshot.

Fixed by declaring `color-scheme: dark` on `.dark` and `light` on `:root`, plus explicit
`option` colours for Firefox and an autofill fix (Chrome's hard-coded pale yellow).

Verified computed styles in both themes:

```
dark    color-scheme=dark    option-bg=rgb(10,12,24)    option-fg=rgb(243,244,251)
light   color-scheme=light   option-bg=rgb(246,247,251) option-fg=rgb(11,13,23)
```

I also fixed a related flash: the server always rendered `class="dark"` and the theme was
only applied after hydration, so light-theme users saw a dark flash on every navigation.
A tiny inline script in `<head>` now applies the saved theme before first paint.

## 3. Production `Error: Connection closed.`

Two contributing causes, both addressed:

- **The 1.46 MB response.** A Netlify function streaming that much HTML on a cold start is
  what closed the connection before the page finished. The size fix above is the main cure.
- **Reused sockets.** Serverless containers reuse HTTP connections between invocations;
  when the platform freezes one, the next query fails with "Connection closed" *before it
  reaches Turso*. `all()` and `run()` now retry once on connection-level faults
  (`connection closed`, `stream closed`, `ECONNRESET`, `fetch failed`). Safe even for
  writes, because the statement never executed.

> The `Permissions policy violation: unload` lines are from Netlify's own
> `logsListener.bundle.js`, not our code — harmless and not something we control.

## Verified after all changes
Header search returns results · full sell wizard reaches the form with the credential
vault · offers pagination (31 rows + pager) · edit modal opens and loads the catalog on
demand · **zero page errors**.

## Deploy
Just push. `npm run build` migrates the database first, so nothing manual is needed —
and the same command works unchanged when you move to your VPS.
