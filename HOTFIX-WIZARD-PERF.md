# Hotfix — 347 requests per page: the 15-20s stall AND the Netlify white screen

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Verified in a real browser.

---

## One root cause behind two of your three problems

Games with no uploaded logo pointed at `/api/gameart/<slug>` — a route that generated an
SVG tile **and hit the database** to look up the game's name.

That was fine with a handful of games. But the seller wizard lists *every* game in a
category (115 for Items) and the picker rendered them all eagerly. Measured on the real
page:

```
/seller/sell/items    →  347 separate HTTP requests to /api/gameart
```

- **Locally** the browser queued 347 round-trips, each doing a DB read → the 15-20 second
  stall you saw after clicking "New offer".
- **On Netlify** each of those is a separate serverless invocation. The browser opened
  hundreds of connections at once, the function pool saturated, and the RSC stream was cut
  mid-flight. That is exactly what produces
  `Application error: a client-side exception has occurred` with
  `Error: Connection closed.` in the console.

So the white screen was not a separate bug — it was the same 347 requests, failing harder
on serverless than on your laptop.

## The fix

Tiles are now generated as **inline `data:` URIs** (`src/lib/gameart.ts`). The colour comes
from a hash of the slug and the letters from the game name, so the markup itself carries
the image:

- **zero** network requests
- **zero** database reads
- ~380 bytes per tile, identical on server and client

I also stopped persisting the placeholder path — `games.logo` is now empty for generated
tiles (169 rows cleared), so the dead route no longer leaks into the RSC payload. The
`/api/gameart` route is deleted. **Uploading a real logo in admin still overrides it**, and
that path is untouched.

Separately, the game dropdown now renders at most **60 rows** with a "+N more — type to
narrow the list" hint. Painting 115 rows for a list that shows ~8 at a time was wasted work
even with inline art.

### Measured result

| Page | Requests before | Requests after | Size | Time |
|---|---|---|---|---|
| `/seller/sell/items` | **347** | **0** | 127 KB | 44 ms |
| `/seller/sell/accounts` | 269 | **0** | 122 KB | 32 ms |
| `/c/items` | 347 | **0** | 263 KB | 40 ms |
| `/` (home) | 272 | **0** | 173 KB | 36 ms |

Full browser load of the Items wizard: **1.77 s**, 0 gameart requests, 0 page errors.

## Guaranteed Delivery Time

The options were already in the database, but they were being generated per game tile on a
page that was timing out — so the dropdown often never got to render. Confirmed correct
now, read live from the running app:

```
Choose · 20 min · 1 H · 5 H · 12 H · 1 day · 2 days · 3 days · 7 days · 14 days · 30 days
```

## Also fixed
A stale `.next` type stub for the deleted route was breaking `tsc`. Cleared, and the build
is clean from scratch.

## Still not ours
`[Violation] Permissions policy violation: unload` comes from Netlify's injected
`logsListener.bundle.js`, not our code. It will disappear on your VPS.

## Deploy
Just push — `npm run build` migrates first. Note the `games.logo` cleanup ran against your
**local** database; run this once against Turso so live games use inline tiles too:

```bash
TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> \
  npx tsx -e "import{createClient}from'@libsql/client';const d=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});d.execute(\"UPDATE games SET logo='' WHERE logo LIKE '/api/gameart/%'\").then(r=>console.log('cleared',r.rowsAffected))"
```

Without it the live site keeps requesting a route that no longer exists.
