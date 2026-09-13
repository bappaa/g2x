import { NextRequest, NextResponse } from "next/server";
import { one, run, nid } from "@/lib/db";
import { createSession } from "@/lib/session";

/**
 * Real Google OAuth 2.0 (Authorization Code flow).
 *
 * .env:
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 *   NEXT_PUBLIC_APP_URL=https://yourdomain.com
 *
 * Authorised redirect URI in Google Cloud Console:
 *   https://yourdomain.com/api/auth/google?callback=1
 */

function appUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `${req.nextUrl.protocol}//${req.headers.get("host")}`
  );
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const base = appUrl(req);
  const redirectUri = `${base}/api/auth/google?callback=1`;
  const sp = req.nextUrl.searchParams;
  const next = sp.get("next") || "/dashboard";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(
        "Google sign-in is not configured on this server."
      )}`
    );
  }

  /* ---------- step 1: send the user to Google ---------- */
  if (!sp.get("callback")) {
    const state = Buffer.from(JSON.stringify({ next })).toString("base64url");
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", clientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", "openid email profile");
    auth.searchParams.set("state", state);
    auth.searchParams.set("prompt", "select_account");
    return NextResponse.redirect(auth.toString());
  }

  /* ---------- step 2: handle the callback ---------- */
  const code = sp.get("code");
  if (!code)
    return NextResponse.redirect(`${base}/login?error=${encodeURIComponent("Google sign-in cancelled.")}`);

  let target = "/dashboard";
  try {
    const st = sp.get("state");
    if (st) target = JSON.parse(Buffer.from(st, "base64url").toString()).next || target;
  } catch {}

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!token.access_token) throw new Error(token.error || "token exchange failed");

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const info = (await infoRes.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    if (!info.email) throw new Error("Google did not return an email address");

    const email = info.email.toLowerCase();
    let user = await one<{ id: string; status: string }>(
      `SELECT id, status FROM users WHERE email = ?`,
      [email]
    );

    if (!user) {
      const id = nid("usr_");
      await run(
        `INSERT INTO users (id, name, email, provider, avatar, role)
         VALUES (?,?,?,'google',?, 'buyer')`,
        [id, info.name || email.split("@")[0], email, info.picture ?? null]
      );
      await run(
        `INSERT INTO notifications (id, user_id, title, body, href, kind) VALUES (?,?,?,?,?,?)`,
        [
          nid("ntf_"),
          id,
          `Welcome to G2X.GG!`,
          "Your account is ready. Browse top-ups, accounts, currency and more.",
          "/",
          "system",
        ]
      );
      user = { id, status: "active" };
    } else if (user.status === "banned") {
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent("This account has been suspended.")}`
      );
    } else if (info.picture) {
      await run(`UPDATE users SET avatar=COALESCE(avatar,?) WHERE id=?`, [info.picture, user.id]);
    }

    await createSession(
      user.id,
      req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
      req.headers.get("user-agent") ?? undefined
    );

    return NextResponse.redirect(`${base}${target.startsWith("/") ? target : "/dashboard"}`);
  } catch (e) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(
        "Google sign-in failed: " + (e as Error).message
      )}`
    );
  }
}
