import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge security layer. Runs before every request.
 *
 *  1. CSRF — Server Actions are POSTs. Next.js checks Origin against Host, but
 *     that is bypassable behind misconfigured proxies, so we enforce it here
 *     too against an explicit allowlist.
 *  2. Security headers — CSP, HSTS, frame/permission policy.
 *  3. Auth pre-check on /admin and the panels: no session cookie means we never
 *     even reach the database. (Real authorisation still happens server-side —
 *     this is only a cheap first gate.)
 *  4. Blocks probing for common exploit paths (.env, .git, wp-admin, …).
 */

const PROTECTED = ["/admin", "/dashboard", "/seller"];

// bots hunting for leaked config / other stacks — never a real route here
const BAD_PATH =
  /(^|\/)(\.env|\.git|\.aws|\.ssh|wp-admin|wp-login|phpmyadmin|xmlrpc\.php|vendor\/phpunit|config\.json|id_rsa)(\/|$)/i;

function allowedOrigins(req: NextRequest): string[] {
  const list = [req.nextUrl.origin];
  const host = req.headers.get("host");
  if (host) {
    list.push(`https://${host}`, `http://${host}`);
  }
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) list.push(app.replace(/\/$/, ""));
  return list;
}

let keyCache: Uint8Array | null = null;
function secret(): Uint8Array {
  if (keyCache) return keyCache;
  const s = process.env.AUTH_SECRET;
  keyCache = new TextEncoder().encode(
    s && s.length >= 16 ? s : "dev-only-insecure-secret-change-me-please"
  );
  return keyCache;
}

async function verify(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (BAD_PATH.test(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  /* ------------------------- 1. CSRF / origin ------------------------- */
  if (req.method === "POST") {
    const origin = req.headers.get("origin");
    // Same-origin browser POSTs always carry Origin. A missing one is either a
    // non-browser client or a stripped header — reject rather than guess.
    if (!origin || !allowedOrigins(req).includes(origin)) {
      return new NextResponse("Blocked: bad origin", { status: 403 });
    }
  }

  /* ------------------------ 2. cheap auth gate ------------------------ */
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = req.cookies.get("g2x_session")?.value;
    // Verify the signature/expiry at the edge. A cookie that merely *exists*
    // used to pass, and the page then threw UNAUTHORIZED deeper in the render.
    const valid = token ? await verify(token) : false;
    if (!valid) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      const res = NextResponse.redirect(url);
      if (token) res.cookies.delete("g2x_session"); // drop the stale cookie
      return res;
    }
  }

  /* ------------------------ 3. security headers ----------------------- */
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", pathname);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  const prod = process.env.NODE_ENV === "production";

  // Next's inline bootstrap and styled-jsx need 'unsafe-inline'; scripts also
  // need 'unsafe-eval' in dev for React Refresh.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(prod ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  res.headers.set("X-DNS-Prefetch-Control", "off");
  if (prod)
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  // never let a proxy or CDN cache an authenticated page
  if (PROTECTED.some((p) => pathname.startsWith(p)))
    res.headers.set("Cache-Control", "private, no-store, max-age=0");

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|art/).*)"],
};
