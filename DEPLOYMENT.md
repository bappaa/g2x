# G2X.GG — Production Deployment Guide (Contabo VPS)

Everything needed to take G2X from your laptop to a public HTTPS site your client
can visit. Follow it top to bottom; each step says what to run **on your PC** vs
**on the server**.

Budget about **60–90 minutes** the first time.

---

## Table of contents

1. [Before you start](#1-before-you-start)
2. [Set up the Turso database](#2-set-up-the-turso-database)
3. [Set up transactional email (Resend)](#3-set-up-transactional-email-resend)
4. [Set up Google login](#4-set-up-google-login-optional)
5. [Point your domain at the VPS](#5-point-your-domain-at-the-vps)
6. [Prepare the Contabo server](#6-prepare-the-contabo-server)
7. [Deploy the app](#7-deploy-the-app)
8. [Keep it running with PM2](#8-keep-it-running-with-pm2)
9. [Nginx + free HTTPS](#9-nginx--free-https)
10. [Final production checklist](#10-final-production-checklist)
11. [Updating the site later](#11-updating-the-site-later)
12. [Backups](#12-backups)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Before you start

You need:

| Thing | Where | Cost |
|---|---|---|
| Contabo VPS (min **VPS S**: 4 vCPU / 8 GB) | contabo.com | ~€6/mo |
| A domain (e.g. `g2x.gg`) | Namecheap / Cloudflare / GoDaddy | ~€10/yr |
| Turso account | turso.tech | Free tier is fine to start |
| Resend account | resend.com | Free tier = 3,000 emails/mo |

When Contabo provisions the VPS they email you the **IP address** and the **root
password**. Keep those handy.

> **Pick Ubuntu 22.04 LTS or 24.04 LTS** as the operating system when ordering.
> Every command below assumes Ubuntu.

---

## 2. Set up the Turso database

Turso hosts your database in the cloud, so your data survives even if you rebuild
the server. **Run these on your PC.**

```bash
# Install the Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

turso auth signup          # or: turso auth login

# Create the database — pick a region close to your buyers
turso db create g2x --location bom     # bom = Mumbai. Others: fra, lhr, sin, iad

# Get the two values you need
turso db show g2x --url                # -> libsql://g2x-yourorg.turso.io
turso db tokens create g2x             # -> eyJhbGciOi... (long string)
```

Save both. You will paste them into the server's `.env.local` in step 7.

### Load the schema into Turso

Still on your PC, in the project folder:

```bash
cd g2x

# Point at the cloud DB
cat >> .env.local <<'EOF'
TURSO_DATABASE_URL=libsql://g2x-yourorg.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
EOF

npm run db:setup      # creates tables + seeds catalog, CMS, nav, gateways
npm run check:env     # confirm it connected and the tables exist
```

`db:setup` is safe to run once against an empty database. **Do not re-run it on a
live site** — use `npm run db:content` instead, which only refreshes catalog/CMS
content and never touches users or orders.

> **Prefer to skip Turso?** The app also runs on a local SQLite file on the VPS
> (leave both Turso vars unset). It's simpler and faster, but the data lives only
> on that disk — see [Backups](#12-backups). Turso is the safer choice for a
> client demo.

---

## 3. Set up transactional email (Resend)

1. Sign up at **resend.com** and go to **Domains → Add Domain**, enter `g2x.gg`.
2. Resend shows you **DKIM / SPF DNS records**. Add each one at your domain
   registrar (same place you'll add the A record in step 5).
3. Wait for the domain to show **Verified** (usually minutes, up to 24h).
4. Go to **API Keys → Create API Key**, copy the `re_...` value.

You'll set `RESEND_API_KEY=re_...` on the server in step 7.

**While the domain is still pending**, set `MAIL_DOMAIN` to a domain you have
already verified and mail keeps working — the department names are preserved and
only the domain is swapped (`support@g2x.gg` → `support@<MAIL_DOMAIN>`).

Once deployed, verify it end-to-end from
**Admin → Settings → Transactional email → Send test email**. It reports the exact
provider error if something is wrong, so you never have to guess.

> If `RESEND_API_KEY` is unset, the site still works perfectly — emails are just
> written to the server log instead of being sent.

---

## 4. Set up Google login (optional)

1. **console.cloud.google.com** → create a project.
2. **APIs & Services → OAuth consent screen** → External → fill in the app name
   and support email → Publish.
3. **Credentials → Create Credentials → OAuth client ID → Web application**.
4. Under **Authorised redirect URIs** add exactly:
   ```
   https://g2x.gg/api/auth/google?callback=1
   ```
5. Copy the **Client ID** and **Client secret**.

Without these the Google button signs in a demo account — fine for a client demo,
but set them up before real users arrive.

---

## 5. Point your domain at the VPS

At your registrar's DNS panel, create two **A records** pointing at your Contabo
IP:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `your.vps.ip.address` | Automatic |
| A | `www` | `your.vps.ip.address` | Automatic |

Check it has propagated (can take 5–60 minutes):

```bash
dig +short g2x.gg
```

**Do not continue to step 9 (HTTPS) until this returns your VPS IP** — Let's
Encrypt validates over DNS and will fail otherwise.

---

## 6. Prepare the Contabo server

SSH in from your PC:

```bash
ssh root@your.vps.ip.address
```

### 6a. Update and create a non-root user

Running the app as root is a security risk.

```bash
apt update && apt upgrade -y

adduser g2x                  # choose a strong password
usermod -aG sudo g2x

# Copy your SSH key over so you can log in as the new user
rsync --archive --chown=g2x:g2x ~/.ssh /home/g2x/
```

Now log out and back in as `g2x`:

```bash
exit
ssh g2x@your.vps.ip.address
```

### 6b. Install Node.js 20

Ubuntu's default Node is too old — Next.js 14 needs 18.17+.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v      # must print v20.x
npm -v
```

### 6c. Install the supporting tools

```bash
sudo apt install -y git nginx
sudo npm install -g pm2
```

### 6d. Lock down the firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

Port 3000 is deliberately **not** opened — Nginx will proxy to it internally.

---

## 7. Deploy the app

### 7a. Get the code onto the server

**Option A — Git (recommended).** Push your project to GitHub, then:

```bash
cd ~
git clone https://github.com/yourname/g2x-gaming.git g2x
cd g2x
```

**Option B — upload directly.** From **your PC**, in the folder *containing* the
project:

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
      ./g2x/ g2x@your.vps.ip.address:/home/g2x/g2x/
```

### 7b. Create the production environment file

On the server:

```bash
cd ~/g2x
nano .env.local
```

Paste this, substituting your real values:

```bash
# REQUIRED — generate a NEW one for production, do not reuse your dev secret
AUTH_SECRET=paste-output-of-openssl-rand-base64-48

# REQUIRED — your real public URL, no trailing slash.
# A wrong value here makes every form submission return 403.
NEXT_PUBLIC_APP_URL=https://g2x.gg

# Database (from step 2)
TURSO_DATABASE_URL=libsql://g2x-yourorg.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...

# Email (from step 3)
RESEND_API_KEY=re_...
MAIL_DOMAIN=g2x.gg

# Google login (from step 4)
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

# KYC uploads — absolute path on a persistent disk, OUTSIDE the project folder
KYC_STORAGE_DIR=/var/lib/g2x/kyc
```

Generate the secret with:

```bash
openssl rand -base64 48
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

Create the KYC folder:

```bash
sudo mkdir -p /var/lib/g2x/kyc
sudo chown -R g2x:g2x /var/lib/g2x
chmod 700 /var/lib/g2x/kyc
```

### 7c. Install, verify, build

```bash
npm ci                 # reproducible install from package-lock.json
npm run check:env      # <-- fix anything it flags before continuing
npm run build
```

`check:env` verifies the secret, the URL, the database connection, the tables, the
admin user and the mail config. **It must report 0 errors.**

If this is a brand-new database that you did *not* seed in step 2:

```bash
npm run db:setup
```

Test it manually before setting up the service:

```bash
npm start          # then Ctrl+C once you see "Ready"
```

---

## 8. Keep it running with PM2

PM2 restarts the app if it crashes and starts it again after a reboot.

```bash
cd ~/g2x
pm2 start npm --name g2x -- start
pm2 save
pm2 startup systemd        # prints a command — copy/paste and run it
```

Useful commands:

```bash
pm2 status           # is it alive?
pm2 logs g2x         # live logs (Ctrl+C to exit)
pm2 logs g2x --lines 200
pm2 restart g2x
pm2 stop g2x
pm2 monit            # live CPU / memory
```

---

## 9. Nginx + free HTTPS

### 9a. Reverse proxy

```bash
sudo nano /etc/nginx/sites-available/g2x
```

Paste (change `g2x.gg` to your domain):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name g2x.gg www.g2x.gg;

    # Uploaded ID photos and media can be a few MB
    client_max_body_size 12M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # Long-cache Next's immutable build assets
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/g2x /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t              # must say "syntax is ok"
sudo systemctl reload nginx
```

Your site should now load at `http://g2x.gg`.

### 9b. HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d g2x.gg -d www.g2x.gg
```

Answer the prompts and choose **redirect HTTP → HTTPS** when asked. Certbot edits
the Nginx config for you and installs an auto-renewal timer.

Verify renewal works:

```bash
sudo certbot renew --dry-run
```

Now visit **https://g2x.gg** — you should see the padlock.

> **Important:** if you changed the domain, make sure `NEXT_PUBLIC_APP_URL` in
> `.env.local` matches the final `https://` URL exactly, then
> `pm2 restart g2x`. Mismatches cause 403 errors on every form.

---

## 10. Final production checklist

Run through this before handing the URL to your client.

```bash
cd ~/g2x && npm run check:env      # must be 0 errors
```

**Security**

- [ ] `AUTH_SECRET` is a fresh 48-byte random value, different from development
- [ ] Changed the default admin password (log in as `admin@g2x.gg`, then
      **Dashboard → Security → Change password**)
- [ ] Deleted or renamed the demo accounts (`buyer@g2x.gg`, `seller@g2x.gg`) in
      **Admin → Users**
- [ ] `ufw status` shows only OpenSSH + Nginx Full
- [ ] HTTPS padlock works and HTTP redirects to HTTPS
- [ ] `KYC_STORAGE_DIR` is outside the project folder and `chmod 700`

**Configuration**

- [ ] `NEXT_PUBLIC_APP_URL` is the exact public https URL, no trailing slash
- [ ] Test email delivers (Admin → Settings → **Send test email**)
- [ ] Google login works (or you accept the demo fallback)
- [ ] Payment gateway fees reviewed in **Admin → Payment Gateways**
- [ ] Commission % and fees reviewed in **Admin → Settings → Fees**

**Content**

- [ ] Homepage sections edited in **Admin → CMS Blocks**
- [ ] Marquee messages set in **Admin → CMS Blocks → Announcement Bar**
- [ ] Games / categories / products reviewed in **Admin → Catalog**
- [ ] Seeded demo content removed via
      **Admin → Settings → Remove seeded content** when you're ready for real data

**Smoke test the real flows**

- [ ] Register a new buyer → verify the welcome email arrives
- [ ] Buy a product → check the order appears in the buyer *and* seller panels
- [ ] Send a message buyer→seller and confirm it appears without refreshing
- [ ] Request a withdrawal as the seller and approve it as admin

---

## 11. Updating the site later

```bash
ssh g2x@your.vps.ip.address
cd ~/g2x

git pull                  # or rsync again from your PC

npm ci
npm run build
pm2 restart g2x
```

If you changed the database schema, apply migrations **before** restarting:

```bash
npm run db:migrate        # additive only — never drops data
```

Zero-downtime is not necessary at this scale; the restart takes ~2 seconds.

---

## 12. Backups

### If you use Turso (recommended)

Turso keeps automatic point-in-time backups. To take your own snapshot:

```bash
turso db shell g2x .dump > g2x-backup-$(date +%F).sql
```

### If you use the local SQLite file

The database is `~/g2x/g2x.db`. **You must copy the `-wal` and `-shm` files too**,
or the copy will be missing recent writes:

```bash
cd ~/g2x
cp g2x.db* /home/g2x/backups/
```

Automate it daily with cron:

```bash
mkdir -p ~/backups
crontab -e
```

Add:

```cron
0 3 * * * cd /home/g2x/g2x && cp g2x.db* /home/g2x/backups/ && find /home/g2x/backups -mtime +14 -delete
```

**Also back up `/var/lib/g2x/kyc`** — it holds uploaded ID documents and is not in
the database.

---

## 13. Troubleshooting

**Site shows 502 Bad Gateway**
The Node app isn't running. `pm2 status`, then `pm2 logs g2x --lines 100`.

**Every form submission returns 403**
`NEXT_PUBLIC_APP_URL` doesn't match the URL in the browser. It is the POST origin
allowlist in `middleware.ts`. Fix it, then `pm2 restart g2x`.

**"UNAUTHORIZED" or endless redirect to /login**
Your `AUTH_SECRET` changed, invalidating existing cookies. Clear cookies for the
site and log in again. Never rotate this value on a live site without warning users.

**Emails aren't arriving**
Use **Admin → Settings → Send test email** — it surfaces the real provider error.
Most common cause: the domain isn't verified in Resend yet. Set `MAIL_DOMAIN` to a
verified domain in the meantime. Also check `mail_enabled` is `on`.

**Database changes don't show up**
Next caches aggressively. `pm2 restart g2x`. If it persists,
`rm -rf .next && npm run build && pm2 restart g2x`.

**Out of memory during `npm run build`**
Contabo VPS S has 8 GB and is fine, but on a smaller box add swap:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Check what's actually listening**

```bash
ss -lntp
```

You should see Node on `127.0.0.1:3000` and Nginx on `:80` / `:443`.
