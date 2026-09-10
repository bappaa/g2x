# Moving the database to your VPS NVMe

You are off Netlify and off Turso. Everything now lives in **one SQLite file on your
own disk**. This is the complete setup, and the operational bits that matter afterwards.

---

## Why this is faster

Every query used to be an HTTP round-trip to Turso's servers — roughly **30-60 ms**, on
every single query, and a page makes several. Reading a local file on NVMe is about
**0.05 ms**. That is not a small optimisation; it removes the dominant cost of almost
every page render.

It also deletes a whole class of failure: no auth tokens, no rate limits, no network
partitions, and no more of the `Connection closed` errors that came from frozen
serverless sockets.

The trade-off is that **backups are now your job**. That is covered below, and it is not
optional.

---

## 1. Create the database directory

Put it **outside** the app folder. If it lives inside, a `git pull`, a rebuild or a
redeploy can wipe your production data.

```bash
sudo mkdir -p /var/lib/g2x
sudo chown $USER:$USER /var/lib/g2x
chmod 750 /var/lib/g2x
```

## 2. Point the app at it

In your production `.env.local` (or the systemd `Environment=` lines):

```bash
DATABASE_PATH=/var/lib/g2x/g2x.db

# Remove these two entirely — they override DATABASE_PATH when set:
# TURSO_DATABASE_URL=...
# TURSO_AUTH_TOKEN=...
```

While you are here, move the KYC uploads out of the app folder too. They are
customers' ID documents and default to `.private-uploads/` inside the project, so a
`git pull` deletes them:

```bash
sudo mkdir -p /var/lib/g2x/kyc
sudo chown $USER:$USER /var/lib/g2x/kyc
chmod 700 /var/lib/g2x/kyc
```

```bash
KYC_STORAGE_DIR=/var/lib/g2x/kyc
```

Everything else (`AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`) stays as it is.

## 3. Build the database

On a **fresh** VPS, run once:

```bash
cd /var/www/g2x
npm ci
npm run db:seed        # schema + admin account
npm run db:migrate     # indexes and later columns
npm run db:options     # dropdown values
npm run db:cms         # homepage content blocks
npm run db:nav         # header / footer links
npm run db:gateways    # payment methods
npm run db:catalog-new # your 169 games
npm run db:sellflow    # per-category seller forms
```

Then verify:

```bash
npm run check:env
```

It now checks the database **path**, that the directory exists, and that it is
**writable** — the three things that actually break a VPS deploy.

## 4. Build and run

```bash
npm run build          # migrates the DB, then builds
pm2 restart g2x        # or: sudo systemctl restart g2x
```

`npm run build` runs migrations first, so a deploy that adds a column applies it before
the new code serves a single request. This used to be skipped entirely when
`TURSO_DATABASE_URL` was absent — on a VPS that meant migrations silently never ran.
Fixed.

---

## 5. Backups — do this now

The data is on one disk. A disk fails, a `rm` goes wrong, or a bad migration lands.

```bash
npm run db:backup
```

This uses SQLite's `VACUUM INTO`, which takes a **consistent snapshot while the site is
live**. Do not use `cp` — it can copy a half-written page and hand you a corrupt file
that only fails the day you need it. The script also runs an integrity check before
writing and prunes to the newest 14 snapshots.

Schedule it nightly:

```bash
crontab -e
```

```cron
0 3 * * * cd /var/www/g2x && /usr/bin/npm run db:backup >> /var/log/g2x-backup.log 2>&1
```

Optional overrides: `BACKUP_DIR` (default `/var/backups/g2x`), `BACKUP_KEEP` (default 14).

### Get the backups off the box

A backup on the same disk does not survive that disk dying:

```bash
0 4 * * * rsync -az /var/backups/g2x/ user@backup-host:/backups/g2x/
```

Back up the KYC documents on the same schedule — they are not in the database:

```bash
30 3 * * * tar -czf /var/backups/g2x/kyc-$(date +\%F).tar.gz -C /var/lib/g2x kyc
```

## 6. Restoring

```bash
sudo systemctl stop g2x           # or: pm2 stop g2x
npm run db:restore                # dry run — shows what it would restore
npm run db:restore -- --yes       # actually restore the newest snapshot
sudo systemctl start g2x
```

Safety rails, all of which are tested:

- verifies the snapshot's integrity **before** touching anything
- **refuses to run while the app is live** (a `-wal` file means something has it open)
- copies the current database to `*.pre-restore-<timestamp>` first
- deletes the stale `-wal`/`-shm` **before** swapping the file in
- re-verifies the restored file and prints the row count

> That third-to-last point matters more than it looks. Leaving the old write-ahead log in
> place makes SQLite replay it over the restored snapshot, producing
> `database disk image is malformed`. I hit exactly that while testing this and fixed it —
> the restore is now verified end to end: wiped the games table, restored, got all 169
> back with a clean integrity check.

Restore a specific snapshot:

```bash
npm run db:restore -- g2x-2026-01-05T03-00-00.db --yes
```

---

## What changed in the code

| File | Change |
|---|---|
| `src/lib/db.ts` | Local SQLite first via `DATABASE_PATH`; WAL + tuning pragmas; retries `SQLITE_BUSY` |
| `scripts/db-url.mjs` | One resolver every script shares, so seeders and the app never disagree |
| `scripts/deploy-migrate.mts` | Always migrates (previously skipped without a Turso URL); creates the directory |
| `scripts/check-env.mts` | Validates the path, directory existence and write permission |
| `scripts/backup-db.mts` | **New** — consistent snapshots with rotation |
| `scripts/restore-db.mts` | **New** — guarded restore with verification |
| `.env.example` | Documents `DATABASE_PATH`; Turso demoted to optional |

Turso still works if you ever set both variables again — the remote path is kept, just no
longer the default.

### SQLite tuning applied automatically

| Pragma | Why |
|---|---|
| `journal_mode=WAL` | Readers stop blocking the writer. The single biggest win — the default journal serialises everything. |
| `synchronous=NORMAL` | fsync at checkpoints instead of every commit. Safe under WAL, much faster writes. |
| `busy_timeout=5000` | Wait for a lock instead of instantly throwing `SQLITE_BUSY`. |
| `foreign_keys=ON` | Actually enforce the constraints the schema declares. |
| `cache_size=-64000` | 64 MB page cache. |
| `temp_store=MEMORY` | Sorts and temp tables in RAM. |

You will see `g2x.db-wal` and `g2x.db-shm` next to the database. That is correct and
means WAL is active — never delete them while the app is running.

## Verified

Tested against a database at a `/var/lib`-style path:

- all pages 200 — home, category, seller panel, sell wizard, dashboard, admin: **25-48 ms**
- **40 concurrent writes in 31 ms** (WAL doing its job)
- WAL confirmed active at runtime
- backup → wipe the games table → restore → **169 games back**, integrity `ok`

## One thing to watch

SQLite is single-writer. That is completely fine for a marketplace of this size — writes
are short and WAL keeps readers unblocked — but if you ever scale to multiple app servers
they cannot share this file. At that point you would move to Postgres, not back to Turso.
You are nowhere near that yet.
