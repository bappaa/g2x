# Deploying G2X.GG to Netlify (client demo)

Push to GitHub from VS Code, connect the repo to Netlify, set six environment
variables, done. About **15 minutes**.

> Netlify is great for showing the client a live link. For the **real** launch use
> a VPS — see [DEPLOYMENT.md](./DEPLOYMENT.md). The one feature that does not work
> on Netlify is **KYC document upload**, because serverless functions have a
> read-only filesystem. Everything else — login, buying, selling, chat, admin —
> works fully. (The app now shows a clear message for that one case instead of
> crashing.)

---

## What was fixed for Netlify

The white screen with **"Application error: a server-side exception has occurred"**
was not your environment variables — those were correct. The cause was the
database driver.

`@libsql/client` has two builds. The default one is for Node and **statically
imports a native binary** (`libsql.node`) so it can open local SQLite files.
Netlify bundles your server code into a Lambda-style function that cannot ship or
load a `.node` binary, so the function threw the moment it was imported — before a
single line of your page ran. Every server-rendered route died, which is why
`/login` broke instantly.

`src/lib/db.ts` now imports **`@libsql/client/web`** for remote Turso URLs. It
speaks the identical Turso HTTP protocol using only `fetch`, with no native
dependency. The Node build is loaded lazily and only when the URL is a local
`file:` path, so it never enters the serverless bundle.

Also added: `netlify.toml`, the `@netlify/plugin-nextjs` build plugin, and a
graceful error for KYC uploads on read-only storage.

**You don't need to change any code — just push and set the variables below.**

---

## Step 1 — Push to GitHub from VS Code

In VS Code:

1. **Source Control** panel (`Ctrl+Shift+G`)
2. **Initialize Repository** if the project isn't a git repo yet
3. Type a commit message, e.g. `Netlify-ready build`, then **Commit**
4. Click **Publish Branch** → choose **private** repository

Or from the terminal:

```bash
cd g2x
git init
git add .
git commit -m "Netlify-ready build"
git branch -M main
git remote add origin https://github.com/YOURNAME/g2x-gaming.git
git push -u origin main
```

### Confirm your secrets are NOT committed

`.gitignore` already excludes them, but verify:

```bash
git ls-files | grep -E "\.env|g2x\.db"
```

**This must print nothing.** If it lists `.env.local`, remove it from git history
before pushing:

```bash
git rm --cached .env.local
git commit -m "Remove env file"
```

---

## Step 2 — Create the Turso database

Netlify has no persistent disk, so the local SQLite file cannot be used. You need
Turso. **On your PC:**

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup

turso db create g2x --location bom      # bom = Mumbai; also fra, lhr, sin, iad

turso db show g2x --url                 # -> TURSO_DATABASE_URL
turso db tokens create g2x              # -> TURSO_AUTH_TOKEN
```

### Load the schema and demo data into Turso

Still on your PC, in the project folder — this fills the **cloud** database:

```bash
cd g2x

# Temporarily point your local .env.local at Turso
# (add these two lines, or uncomment them)
#   TURSO_DATABASE_URL=libsql://g2x-yourorg.turso.io
#   TURSO_AUTH_TOKEN=eyJhbGciOi...

npm run db:setup       # creates all tables + seeds catalog, CMS, nav, gateways
npm run check:env      # must report 0 errors and "Connected — N tables"
```

> **This step is essential.** If you skip it, Netlify connects to an empty
> database and every page 500s with the same error message you saw.

---

## Step 3 — Connect the repo to Netlify

1. Go to **app.netlify.com** → **Add new site** → **Import an existing project**
2. Choose **GitHub**, authorise, pick your repository
3. Netlify reads `netlify.toml` and fills these in automatically — leave them:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. **Do not deploy yet** — click **Add environment variables** first (next step).

---

## Step 4 — Set the environment variables

**Site configuration → Environment variables → Add a variable.**

| Key | Value |
|---|---|
| `AUTH_SECRET` | a fresh 48-byte random string (see below) |
| `TURSO_DATABASE_URL` | `libsql://g2x-yourorg.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` |
| `NEXT_PUBLIC_APP_URL` | `https://g2x-gg.netlify.app` |
| `NODE_VERSION` | `20` |
| `RESEND_API_KEY` | `re_...` *(optional — omit and mail is just logged)* |

Generate the secret:

```bash
openssl rand -base64 48
```

### Three things that will bite you

1. **`NEXT_PUBLIC_APP_URL` must exactly match your Netlify URL** — `https://`, no
   trailing slash. It is the POST origin allowlist in `middleware.ts`; a mismatch
   makes every login and form submission return **403**.
2. **Use a different `AUTH_SECRET` than your laptop.** Reusing the dev value means
   dev cookies are valid in production.
3. **No quotes** around values in the Netlify UI. Paste the raw string.

Now click **Deploy site**.

---

## Step 5 — Verify

Wait for the build (~2–4 min), then open your `.netlify.app` URL.

- [ ] Homepage loads with games and products
- [ ] `/login` renders the form (this is the page that was crashing)
- [ ] Log in as `admin@g2x.gg` / `Password123!`
- [ ] Admin panel opens at `/admin`
- [ ] Buy something end to end
- [ ] **Change the admin password immediately** — Dashboard → Security

If a page still errors, open **Netlify → Deploys → your deploy → Functions** and
read the log. The real exception is printed there; the browser only shows a digest.

---

## Step 6 — Custom domain (optional)

**Domain management → Add a domain** → enter `g2x.gg` → follow the DNS
instructions. HTTPS is automatic via Let's Encrypt.

**After the domain is live, update `NEXT_PUBLIC_APP_URL` to `https://g2x.gg` and
redeploy** — otherwise you'll get 403s on every form.

---

## Redeploying after changes

Netlify rebuilds automatically on every push to `main`:

```bash
git add .
git commit -m "your change"
git push
```

Changing an environment variable does **not** rebuild by itself — go to
**Deploys → Trigger deploy → Clear cache and deploy site**.

---

## Netlify vs VPS

| | Netlify | Contabo VPS |
|---|---|---|
| Setup | ~15 min | ~60–90 min |
| HTTPS | Automatic | Certbot |
| Database | Turso required | Turso *or* local SQLite |
| KYC document upload | ❌ read-only disk | ✅ works |
| Cost | Free tier | ~€6/mo |
| Best for | **Client demo** | **Production** |

Use Netlify now to show the client. Move to the VPS with
[DEPLOYMENT.md](./DEPLOYMENT.md) before real users and real KYC.

---

## Troubleshooting

**"Application error: a server-side exception has occurred"**
Check **Deploys → Functions** for the real error. Most likely: `db:setup` was
never run against Turso (empty database), or a Turso variable has a typo/quotes.

**Login returns 403 / "Something went wrong"**
`NEXT_PUBLIC_APP_URL` doesn't match the browser URL exactly. Fix it and redeploy
with cache cleared.

**Build fails: "Module not found: libsql"**
You're on an older `src/lib/db.ts`. Pull the current code — it must import
`@libsql/client/web`.

**Pages show stale content**
Catalog routes cache for 5 minutes (`revalidate = 300`). Wait, or trigger a
deploy with cache cleared.

**"Document uploads are not available on this deployment"**
Expected on Netlify — the filesystem is read-only. Use the VPS for KYC.

## Exchange rates

Prices are stored in USD and converted at render time using **live market
rates**, refreshed hourly from a free, key-less feed (exchangerate-api, with
frankfurter.dev as a fallback). No API key or env var is needed.

- The site self-heals: when the stored rates are more than an hour old, the
  next page render kicks off a background refresh and serves the previous
  values in the meantime — a page never waits on the network.
- Seed the rates right after a deploy with `npm run fx:refresh`. On a host
  that freezes between requests, run the same command from a scheduled job.
- **Admin → Settings → Exchange rates** shows how fresh the rates are, the
  provider, and a **Sync now** button. Leave a currency's field blank to track
  the market; type a number to lock that one currency to a fixed rate (the
  refresher will then skip it). Clear the field to hand it back to the feed.
- If every provider is unreachable, the last stored rates stay in use, and
  those in turn fall back to the static table in `src/lib/i18n.ts`.
