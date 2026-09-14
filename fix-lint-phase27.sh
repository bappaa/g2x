#!/bin/bash
# Fix ALL build failures - ESLint + TS type errors
# Run on VPS: bash fix-lint-phase27.sh
cd ~/g2x || cd /home/g2x/g2x || cd /home/user/g2x || exit 1
pwd
echo "=== Fixing build errors ==="

# 1. admin.ts - remove unused rateLimit import
perl -i -pe 's/import \{ rateLimit, clientIp \} from \"..\/ratelimit\";/import { clientIp } from \"..\/ratelimit\";/' src/lib/actions/admin.ts

# 1b. Fix any types in saveCmsBlockAction
python3 << 'PY'
import pathlib
p = pathlib.Path("src/lib/actions/admin.ts").read_text()
old = """      // Sanitize each item if string
      const sanitized = parsed.map((item: any) => {
        if (typeof item === "string") return sanitizeName(item, 500);
        if (typeof item === "object" && item !== null) {
          const out: any = {};
          for (const k in item) {
            out[sanitizeSlug(k)] = typeof item[k] === "string" ? sanitizeName(item[k], 500) : item[k];
          }
          return out;
        }
        return item;
      });"""
new = """      // Sanitize each item if string
      const sanitized = parsed.map((item: unknown) => {
        if (typeof item === "string") return sanitizeName(item, 500);
        if (typeof item === "object" && item !== null) {
          const out: Record<string, unknown> = {};
          const rec = item as Record<string, unknown>;
          for (const k in rec) {
            out[sanitizeSlug(k)] = typeof rec[k] === "string" ? sanitizeName(rec[k] as string, 500) : rec[k];
          }
          return out;
        }
        return item;
      });"""
if old in p:
    p = p.replace(old, new)
    pathlib.Path("src/lib/actions/admin.ts").write_text(p)
    print("fixed admin.ts any")
else:
    print("admin.ts any already fixed")
PY

# 2. ratelimit.ts - FIXED: remove unused second param entirely, not _bucket
python3 << 'PY'
import pathlib
path = pathlib.Path("src/lib/ratelimit.ts")
t = path.read_text()
# Remove old broken import with 'all'
t = t.replace('import { run, one, all } from "./db";', 'import { run, one } from "./db";')
# Fix trackViolation signature: was (ip, bucket) -> (ip, _bucket) -> now (ip)
t = t.replace('async function trackViolation(ip: string, bucket: string):', 'async function trackViolation(ip: string):')
t = t.replace('async function trackViolation(ip: string, _bucket: string):', 'async function trackViolation(ip: string):')
t = t.replace('async function trackViolation(ip: string, _bucket):', 'async function trackViolation(ip: string):')
# Fix call site: trackViolation(ipMatch[1], cleanKey) -> trackViolation(ipMatch[1])
t = t.replace('void trackViolation(ipMatch[1], cleanKey);', 'void trackViolation(ipMatch[1]);')
t = t.replace('void trackViolation(ipMatch[1],', 'void trackViolation(ipMatch[1]')
path.write_text(t)
print("fixed ratelimit.ts")
PY

# 3. security.ts - remove unused imports
python3 << 'PY'
import pathlib
p = pathlib.Path("src/lib/security.ts").read_text()
p = p.replace('import { headers } from "next/headers";\n', '')
p = p.replace('import { all, one, run, nid } from "./db";\nimport { rateLimit, clientIp } from "./ratelimit";\nimport { containsXSS, containsSQLi, sanitizeSearch } from "./sanitize";', 'import { all, one, run, nid } from "./db";\nimport { rateLimit } from "./ratelimit";\nimport { containsXSS, containsSQLi } from "./sanitize";')
# fallback cleanups
p = p.replace('import { rateLimit, clientIp } from "./ratelimit";', 'import { rateLimit } from "./ratelimit";')
p = p.replace('sanitizeSearch', '')
p = p.replace('containsXSS, containsSQLi,  ', 'containsXSS, containsSQLi ')
p = p.replace('containsXSS, ,', 'containsXSS,')
pathlib.Path("src/lib/security.ts").write_text(p)
print("fixed security.ts")
PY

# 4. media/[id]/route.ts - Fix 4-arg rateLimit call -> 3 args
python3 << 'PY'
import pathlib
for f in ["src/app/api/media/[id]/route.ts", "src/app/api/search/route.ts"]:
    path = pathlib.Path(f)
    if not path.exists():
        continue
    t = path.read_text()
    # Fix: rateLimit(ip, "media_fetch", 100, 60) -> rateLimit(`media_fetch:${ip}`, 100, 60)
    t = t.replace('const rl = await rateLimit(ip, "media_fetch", 100, 60);', 'const rl = await rateLimit(`media_fetch:${ip}`, 100, 60);')
    t = t.replace('const rl = await rateLimit(ip, "search", 30, 60);', 'const rl = await rateLimit(`search:${ip}`, 30, 60);')
    path.write_text(t)
    print(f"fixed {f}")
PY

# 5. Google OTP fixes (already in repo after pull, but ensure)
python3 << 'PY'
import pathlib
# google route
path = pathlib.Path("src/app/api/auth/google/route.ts")
if path.exists():
    t = path.read_text()
    if "INSERT INTO users (id, name, email, provider, avatar, role)" in t:
        t = t.replace(
            "INSERT INTO users (id, name, email, provider, avatar, role)\n         VALUES (?,?,?,'google',?, 'buyer')",
            "INSERT INTO users (id, name, email, provider, avatar, role, email_verified)\n         VALUES (?,?,?,'google',?, 'buyer', 1)"
        )
        path.write_text(t)
        print("fixed google route insert")
    if "} else if (info.picture) {" in t:
        t = t.replace(
            "} else if (info.picture) {\n      await run(`UPDATE users SET avatar=COALESCE(avatar,?) WHERE id=?`, [info.picture, user.id]);\n    }",
            "} else {\n      // Existing user logging in via Google - ensure they are verified and avatar set\n      await run(`UPDATE users SET email_verified=1, avatar=COALESCE(avatar,?) WHERE id=?`, [info.picture ?? null, user.id]);\n    }"
        )
        path.write_text(t)
        print("fixed google route update")

# auth.ts
path2 = pathlib.Path("src/lib/actions/auth.ts")
if path2.exists():
    t = path2.read_text()
    if "INSERT INTO users (id, name, email, provider, role, country, username)\n       VALUES (?,?,?,'google','buyer','',?)" in t:
        t = t.replace(
            "    const id = nid(\"usr_\");\n    await run(\n      `INSERT INTO users (id, name, email, provider, role, country, username)\n       VALUES (?,?,?,'google','buyer','',?)`,\n      [id, \"Demo Buyer\", email, await generateUsername()]\n    );\n    await welcome(id, \"Demo Buyer\");\n    user = { id };\n  }",
            "    const id = nid(\"usr_\");\n    await run(\n      `INSERT INTO users (id, name, email, provider, role, country, username, email_verified)\n       VALUES (?,?,?,'google','buyer','',?,1)`,\n      [id, \"Demo Buyer\", email, await generateUsername()]\n    );\n    await welcome(id, \"Demo Buyer\");\n    user = { id };\n  } else {\n    // Ensure demo google user is verified\n    await run(`UPDATE users SET email_verified=1 WHERE id=?`, [user.id]);\n  }"
        )
        path2.write_text(t)
        print("fixed auth.ts demoGoogle")

# otp.ts
path3 = pathlib.Path("src/lib/otp.ts")
if path3.exists():
    t = path3.read_text()
    if "provider" not in t.split("isEmailVerified")[1][:500] if "isEmailVerified" in t else True:
        # Only fix if not already fixed
        if "String(u.provider" not in t:
            t = t.replace(
                "export async function isEmailVerified(userId: string): Promise<boolean> {\n  try {\n    const u = await one<{ email_verified: number }>(\n      `SELECT email_verified FROM users WHERE id=?`,\n      [userId]\n    );\n    return Number(u?.email_verified ?? 0) === 1;\n  } catch {\n    // Column missing on an un-migrated database — never lock anyone out.\n    return true;\n  }\n}",
                "export async function isEmailVerified(userId: string): Promise<boolean> {\n  try {\n    const u = await one<{ email_verified: number; provider: string }>(\n      `SELECT email_verified, provider FROM users WHERE id=?`,\n      [userId]\n    );\n    if (!u) return false;\n    if (String(u.provider ?? \"\").toLowerCase() === \"google\") return true;\n    return Number(u?.email_verified ?? 0) === 1;\n  } catch {\n    return true;\n  }\n}"
            )
            path3.write_text(t)
            print("fixed otp.ts")

# schema-patches
path4 = pathlib.Path("src/lib/schema-patches.mjs")
if path4.exists():
    t = path4.read_text()
    if "provider='google'" not in t:
        t = t.replace(
            "  `CREATE INDEX IF NOT EXISTS idx_otp_user ON email_otps(user_id, purpose)`,\n];",
            "  `CREATE INDEX IF NOT EXISTS idx_otp_user ON email_otps(user_id, purpose)`,\n\n  // --- Phase 27 fix: Google users are already verified by Google ---\n  `UPDATE users SET email_verified=1 WHERE provider='google' AND email_verified=0`,\n];"
        )
        path4.write_text(t)
        print("fixed schema-patches.mjs")
PY

echo "=== All patches applied, building ==="
rm -rf .next
npm run build
if [ $? -eq 0 ]; then
  echo "=== Build OK ==="
  pm2 restart g2x || pm2 restart g2x --update-env
  sleep 2
  pm2 logs g2x --lines 80 --nostream
  npm run db:ensure 2>&1 | tail -20 || npx tsx scripts/deploy-migrate.mts 2>&1 | tail -20
else
  echo "=== Build FAILED - see above ==="
fi
