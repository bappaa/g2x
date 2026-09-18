import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge security layer - HIGH SECURITY for gaming ecommerce
 * 1. Exploit path blocking
 * 2. Bad UA blocking
 * 3. CSRF origin check
 * 4. Auth gate
 * 5. Security headers
 */

const PROTECTED = ["/admin", "/dashboard", "/seller"];

const BAD_PATH =
  /(^|\/)(?:\.env|\.git|\.aws|\.ssh|wp-admin|wp-login|phpmyadmin|xmlrpc\.php|vendor\/phpunit|config\.json|id_rsa|\.htaccess|composer\.json|\.DS_Store|backup|\.bak|\.sql|adminer|pma|phpinfo\.php|shell\.php|c99\.php|r57\.php|wso\.php|alfa\.php|b374k|eval-stdin)(?:\/|$)/i;

const BAD_PATH_EXTRA = /(?:union\s+select|select\s+\*\s+from|or\s+1\s*=\s*1|drop\s+table|%27|%22|<script|javascript:)/i;

const BAD_UA = /(?:sqlmap|nmap|nikto|dirbuster|gobuster|masscan|zap|burpsuite|acunetix|nessus|havij|wpscan|metasploit|hydra|shodan)/i;

function allowedOrigins(req: NextRequest): string[] {
  const list = [req.nextUrl.origin];
  const host = req.headers.get("host");
  if (host) list.push(`https://${host}`, `http://${host}`);
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) list.push(app.replace(/\/$/, ""));
  if (process.env.NODE_ENV !== "production") {
    list.push("http://localhost:3000", "http://127.0.0.1:3000");
  }
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

const edgeRateLimit = new Map<string, { count: number; reset: number }>();
function checkEdgeRateLimit(key: string, limit: number, windowS: number): boolean {
  const now = Date.now();
  const entry = edgeRateLimit.get(key);
  if (!entry || entry.reset < now) {
    edgeRateLimit.set(key, { count: 1, reset: now + windowS * 1000 });
    if (edgeRateLimit.size > 1000 && Math.random() < 0.1) {
      for (const [k, v] of edgeRateLimit.entries()) if (v.reset < now) edgeRateLimit.delete(k);
    }
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "";

  if (BAD_PATH.test(pathname) || BAD_PATH_EXTRA.test(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (BAD_UA.test(ua) && (pathname.startsWith("/admin") || pathname.startsWith("/api/") || pathname.includes("login"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const allowedMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
  if (!allowedMethods.includes(req.method)) {
    return new NextResponse("Method not allowed", { status: 405 });
  }

  if (pathname.startsWith("/api/search") || pathname.startsWith("/api/auth")) {
    if (!checkEdgeRateLimit(`edge:${ip}:${pathname}`, 30, 60)) {
      return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
    }
  }

  if (req.method === "POST") {
    const origin = req.headers.get("origin");
    if (origin) {
      const allowed = allowedOrigins(req);
      const isAllowed = allowed.some((a) => {
        try { return origin === a || new URL(origin).host === new URL(a).host; } catch { return origin === a; }
      });
      if (!isAllowed) return new NextResponse("Blocked: bad origin", { status: 403 });
    }
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = req.cookies.get("g2x_session")?.value;
    const valid = token ? await verify(token) : false;
    if (!valid) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      const res = NextResponse.redirect(url);
      if (token) res.cookies.delete("g2x_session");
      return res;
    }
  }

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", pathname);
  reqHeaders.set("x-request-id", Math.random().toString(36).slice(2, 10));
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  const prod = process.env.NODE_ENV === "production";

  // Razorpay — needs script from checkout + cdn + api, frames for modal, connect for risk detection & api
  const razorpayScript = "https://checkout.razorpay.com https://api.razorpay.com https://cdn.razorpay.com https://*.razorpay.com";
  const razorpayConnect = "https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com";
  const razorpayFrame = "https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com";
  const razorpayImg = "https://cdn.razorpay.com https://*.razorpay.com";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"} https://www.google.com https://www.gstatic.com ${razorpayScript}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: https: ${razorpayImg}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https://api.exchangerate-api.com https://api.frankfurter.app ${razorpayConnect}`,
    `frame-src 'self' https://www.google.com https://www.gstatic.com ${razorpayFrame}`,
    "frame-ancestors 'none'",
    "form-action 'self' javascript: blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'self' blob:",
    ...(prod ? ["upgrade-insecure-requests", "block-all-mixed-content"] : []),
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://*.razorpay.com\"), usb=(), interest-cohort=(), clipboard-read=(), clipboard-write=(self), fullscreen=(self)"
  );
  if (prod) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    res.headers.set("Pragma", "no-cache");
  }
  if (pathname.startsWith("/api/")) {
    res.headers.set("Cache-Control", "no-store, max-age=0");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|art/|_next/webpack-hmr).*)"],
};
