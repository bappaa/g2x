#!/bin/bash
# Fix ESLint errors that broke Phase 27 build + Google OTP checkout bug
cd ~/g2x || cd /home/g2x/g2x || exit 1
pwd

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
    print("admin.ts any already fixed or not found")
PY

# 2. ratelimit.ts - remove unused all, rename bucket -> _bucket
perl -i -pe 's/import \{ run, one, all \} from \".\/db\";/import { run, one } from \".\/db\";/' src/lib/ratelimit.ts
perl -i -pe 's/function trackViolation\(ip: string, bucket:/function trackViolation(ip: string, _bucket:/' src/lib/ratelimit.ts

# 3. security.ts - remove unused headers, clientIp, sanitizeSearch
python3 << 'PY'
import pathlib
p = pathlib.Path("src/lib/security.ts").read_text()
p = p.replace('import { headers } from "next/headers";\n', '')
p = p.replace('import { all, one, run, nid } from "./db";\nimport { rateLimit, clientIp } from "./ratelimit";\nimport { containsXSS, containsSQLi, sanitizeSearch } from "./sanitize";', 'import { all, one, run, nid } from "./db";\nimport { rateLimit } from "./ratelimit";\nimport { containsXSS, containsSQLi } from "./sanitize";')
# fallback if already partially fixed
if 'clientIp' in p and 'from "./ratelimit"' in p:
    p = p.replace('import { rateLimit, clientIp } from "./ratelimit";', 'import { rateLimit } from "./ratelimit";')
if 'sanitizeSearch' in p:
    p = p.replace('sanitizeSearch', 'containsSQLi').replace('containsSQLi, containsSQLi', 'containsSQLi')
pathlib.Path("src/lib/security.ts").write_text(p)
print("fixed security.ts")
PY

# 4. Google OAuth - set email_verified=1 on insert + update
python3 << 'PY'
import pathlib
# google route
path = pathlib.Path("src/app/api/auth/google/route.ts")
if path.exists():
    t = path.read_text()
    if "email_verified" not in t or "INSERT INTO users (id, name, email, provider, avatar, role)" in t:
        t = t.replace(
            "INSERT INTO users (id, name, email, provider, avatar, role)\n         VALUES (?,?,?,'google',?, 'buyer')",
            "INSERT INTO users (id, name, email, provider, avatar, role, email_verified)\n         VALUES (?,?,?,'google',?, 'buyer', 1)"
        )
        t = t.replace(
            "} else if (info.picture) {\n      await run(`UPDATE users SET avatar=COALESCE(avatar,?) WHERE id=?`, [info.picture, user.id]);\n    }",
            "} else {\n      // Existing user logging in via Google - ensure they are verified and avatar set\n      await run(`UPDATE users SET email_verified=1, avatar=COALESCE(avatar,?) WHERE id=?`, [info.picture ?? null, user.id]);\n    }"
        )
        path.write_text(t)
        print("fixed google route")
    else:
        print("google route already fixed")

# auth.ts demoGoogleAction
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
    else:
        print("auth.ts already fixed or pattern not matched")

# otp.ts - ensure google provider bypass
path3 = pathlib.Path("src/lib/otp.ts")
if path3.exists():
    t = path3.read_text()
    if "provider" not in t.split("isEmailVerified")[1][:500]:
        t = t.replace(
            "export async function isEmailVerified(userId: string): Promise<boolean> {\n  try {\n    const u = await one<{ email_verified: number }>(\n      `SELECT email_verified FROM users WHERE id=?`,\n      [userId]\n    );\n    return Number(u?.email_verified ?? 0) === 1;\n  } catch {\n    // Column missing on an un-migrated database — never lock anyone out.\n    return true;\n  }\n}",
            "export async function isEmailVerified(userId: string): Promise<boolean> {\n  try {\n    const u = await one<{ email_verified: number; provider: string }>(\n      `SELECT email_verified, provider FROM users WHERE id=?`,\n      [userId]\n    );\n    if (!u) return false;\n    if (String(u.provider ?? \"\").toLowerCase() === \"google\") return true;\n    return Number(u?.email_verified ?? 0) === 1;\n  } catch {\n    return true;\n  }\n}"
        )
        path3.write_text(t)
        print("fixed otp.ts")
    else:
        print("otp.ts already fixed")

# schema-patches.mjs - ensure google users verified
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
    else:
        print("schema-patches already fixed")
PY

echo "All fixes applied. Now building..."
rm -rf .next
npm run build
if [ $? -eq 0 ]; then
  echo "Build OK - restarting pm2"
  pm2 restart g2x
  sleep 2
  pm2 logs g2x --lines 80 --nostream
  # also run db ensure to migrate existing google users
  npm run db:ensure || npx tsx scripts/deploy-migrate.mts || echo "db:ensure skipped"
else
  echo "Build FAILED - check logs above"
fi
