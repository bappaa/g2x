import "server-only";
import { one } from "./db";

/**
 * Transactional email via Resend (resend.com).
 *
 * Set RESEND_API_KEY in .env.local to send for real. Without it, emails are
 * logged to the console instead, so local development never sends mail.
 *
 * Every message is sent from the correct department mailbox so replies land in
 * the right inbox, and each type can be switched off in
 * Admin → Settings → Transactional email.
 */

export type MailboxKey =
  | "support" | "sales" | "seller" | "billing" | "refund"
  | "disputes" | "notification" | "security" | "noreply" | "orders";

export const MAILBOXES: Record<MailboxKey, { email: string; name: string; purpose: string }> = {
  support:      { email: "support@g2x.gg",      name: "G2X Support",       purpose: "Main customer support" },
  sales:        { email: "sales@g2x.gg",        name: "G2X Sales",         purpose: "Business / sales" },
  seller:       { email: "seller@g2x.gg",       name: "G2X Seller Team",   purpose: "Seller support" },
  billing:      { email: "billing@g2x.gg",      name: "G2X Billing",       purpose: "Payments & billing" },
  refund:       { email: "refund@g2x.gg",       name: "G2X Refunds",       purpose: "Refunds" },
  disputes:     { email: "disputes@g2x.gg",     name: "G2X Disputes",      purpose: "Buyer / seller disputes" },
  notification: { email: "notification@g2x.gg", name: "G2X",               purpose: "Order & system notifications" },
  security:     { email: "security@g2x.gg",     name: "G2X Security",      purpose: "Security & fraud reports" },
  noreply:      { email: "no-reply@g2x.gg",     name: "G2X",               purpose: "OTP, password reset, verification" },
  orders:       { email: "notification@g2x.gg", name: "G2X Orders",        purpose: "Order lifecycle updates" },
};

const RESEND_URL = "https://api.resend.com/emails";

export type SendResult = { ok: boolean; id?: string; error?: string; skipped?: boolean };

async function setting(key: string, fallback: string): Promise<string> {
  try {
    const r = await one<{ value: string }>(`SELECT value FROM settings WHERE key=?`, [key]);
    return r?.value?.trim() || fallback;
  } catch {
    return fallback;
  }
}

/** Low-level sender. Prefer the named helpers below. */
export async function sendMail(opts: {
  to: string | { email: string; name?: string }[];
  subject: string;
  html: string;
  text?: string;
  from?: MailboxKey;
  replyTo?: string;
  tags?: string[];
}): Promise<SendResult> {
  const box = MAILBOXES[opts.from ?? "notification"];
  const to = typeof opts.to === "string" ? [{ email: opts.to }] : opts.to;

  // Admin master switch + per-type switch from System Settings.
  if ((await setting("mail_enabled", "on")) === "off") {
    return { ok: true, skipped: true };
  }
  const tag = opts.tags?.[0];
  if (tag) {
    const map: Record<string, string> = {
      order: "mail_order", delivered: "mail_delivery", sale: "mail_sale",
      kyc: "mail_kyc", refund: "mail_refund", dispute: "mail_dispute",
      payout: "mail_payout", security: "mail_security", support: "mail_support",
    };
    const k = map[tag];
    if (k && (await setting(k, "on")) === "off") return { ok: true, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info(
      `[mail:skipped] ${box.email} -> ${to.map((t) => t.email).join(", ")} :: ${opts.subject}`
    );
    return { ok: true, skipped: true };
  }

  // Admin can override the display name from System Settings.
  const senderName = await setting("site_name", "G2X.GG");

  /**
   * The sending domain must be one you verified in Resend. Until g2x.gg is
   * verified you can point MAIL_DOMAIN at any verified domain (or Resend's
   * onboarding@resend.dev) without touching the per-department addresses.
   */
  const domain = process.env.MAIL_DOMAIN?.trim();
  const fromEmail = domain ? box.email.replace(/@.+$/, `@${domain}`) : box.email;
  const payload = {
    from: `${`${senderName} ${box.name}`.trim().slice(0, 60)} <${fromEmail}>`,
    to: to.map((t) => t.email),
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? stripHtml(opts.html),
    reply_to: opts.replyTo || box.email,
    tags: opts.tags?.map((t) => ({ name: "type", value: t })),
  };

  // Retry transient failures (network blips, 429 rate limits, 5xx) so a single
  // hiccup never silently loses an order confirmation.
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const json = (await res.json()) as { id?: string };
        return { ok: true, id: json.id };
      }

      const body = await res.text();
      lastErr = `Resend responded ${res.status}: ${body.slice(0, 300)}`;
      // 4xx (bad address, unverified domain) will never succeed on a retry.
      if (res.status < 500 && res.status !== 429) {
        console.error("[mail:error]", lastErr);
        return { ok: false, error: lastErr };
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }

    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 500));
  }

  console.error("[mail:error] giving up after 3 attempts:", lastErr);
  return { ok: false, error: lastErr };
}

const stripHtml = (h: string) =>
  h.replace(/<style[\s\S]*?<\/style>/gi, "")
   .replace(/<[^>]+>/g, " ")
   .replace(/\s+/g, " ")
   .trim();

/* ==================================================================== */
/* Branded template                                                      */
/* ==================================================================== */

export function layout(opts: {
  title: string;
  intro?: string;
  body: string;
  cta?: { label: string; href: string };
  footnote?: string;
}): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://g2x.gg";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0b0b12;font-family:Inter,Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b12;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#13131d;border:1px solid #23233a;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 26px;border-bottom:1px solid #23233a">
          <span style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-.4px">G2X<span style="color:#8b3dff">.GG</span></span>
        </td></tr>
        <tr><td style="padding:26px">
          <h1 style="margin:0 0 10px;font-size:19px;color:#fff;font-weight:800">${esc(opts.title)}</h1>
          ${opts.intro ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#a5a5c0">${esc(opts.intro)}</p>` : ""}
          <div style="font-size:14px;line-height:1.65;color:#d6d6e6">${opts.body}</div>
          ${
            opts.cta
              ? `<div style="margin:22px 0 6px">
                   <a href="${opts.cta.href.startsWith("http") ? opts.cta.href : base + opts.cta.href}"
                      style="display:inline-block;background:#8b3dff;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px">
                     ${esc(opts.cta.label)}
                   </a>
                 </div>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:16px 26px;border-top:1px solid #23233a">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#6d6d8a">
            ${opts.footnote ? esc(opts.footnote) + "<br>" : ""}
            You are receiving this because you have a G2X.GG account.<br>
            © ${new Date().getFullYear()} G2X.GG — all rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const row = (k: string, v: string) =>
  `<tr><td style="padding:4px 0;color:#8f8fae;font-size:13px">${esc(k)}</td>
       <td style="padding:4px 0;color:#fff;font-size:13px;font-weight:600" align="right">${esc(v)}</td></tr>`;

const table = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" style="margin:8px 0 4px">${rows.map(([k, v]) => row(k, v)).join("")}</table>`;

/* ==================================================================== */
/* Named, automated emails                                               */
/* ==================================================================== */

export const mail = {
  /** Welcome / verify — no-reply@ */
  welcome: (to: string, name: string) =>
    sendMail({
      to, from: "noreply", tags: ["welcome"],
      subject: "Welcome to G2X.GG 🎮",
      html: layout({
        title: `Welcome, ${name}!`,
        intro: "Your account is ready. Browse thousands of offers from verified sellers.",
        body: "<p>Every purchase is protected by escrow — the seller is only paid once you confirm delivery.</p>",
        cta: { label: "Start shopping", href: "/" },
      }),
    }),

  /** OTP / password reset — no-reply@ */
  otp: (to: string, code: string, purpose = "verify your email") =>
    sendMail({
      to, from: "noreply", tags: ["otp"],
      subject: `${code} is your G2X verification code`,
      html: layout({
        title: "Your verification code",
        intro: `Use this code to ${purpose}. It expires in 10 minutes.`,
        body: `<div style="margin:14px 0;text-align:center;font-size:31px;letter-spacing:9px;font-weight:900;color:#8b3dff">${esc(code)}</div>
               <p style="color:#8f8fae;font-size:12px">If you did not request this, you can safely ignore this email.</p>`,
        footnote: "Never share this code. G2X staff will never ask for it.",
      }),
    }),

  passwordReset: (to: string, link: string) =>
    sendMail({
      to, from: "noreply", tags: ["password-reset"],
      subject: "Reset your G2X password",
      html: layout({
        title: "Reset your password",
        intro: "Click the button below to choose a new password. The link expires in 1 hour.",
        body: "<p>If you did not request a reset, no action is needed.</p>",
        cta: { label: "Reset password", href: link },
      }),
    }),

  /** Order confirmation — billing@ */
  orderConfirmed: (to: string, o: { code: string; total: string; items: number; method: string }) =>
    sendMail({
      to, from: "billing", tags: ["order"],
      subject: `Order ${o.code} confirmed`,
      html: layout({
        title: "Payment received ✓",
        intro: `Thanks! Order ${o.code} is confirmed and the seller has been notified.`,
        body: table([
          ["Order", o.code],
          ["Items", String(o.items)],
          ["Paid with", o.method],
          ["Total", o.total],
        ]),
        cta: { label: "Track your order", href: `/dashboard/orders` },
      }),
    }),

  /** Delivery — notification@ */
  orderDelivered: (to: string, o: { code: string; title: string }) =>
    sendMail({
      to, from: "notification", tags: ["order", "delivered"],
      subject: `Your order ${o.code} has been delivered`,
      html: layout({
        title: "Your order is ready 🎉",
        intro: `${o.title} has been delivered.`,
        body: "<p>Open your dashboard to reveal the details. Please confirm receipt so the seller can be paid — or open a dispute within 24 hours if something is wrong.</p>",
        cta: { label: "View delivery", href: "/dashboard/orders" },
      }),
    }),

  /** New sale — seller@ */
  newSale: (to: string, o: { code: string; title: string; net: string }) =>
    sendMail({
      to, from: "seller", tags: ["sale"],
      subject: `New sale — ${o.code}`,
      html: layout({
        title: "You made a sale 💰",
        intro: `${o.title} just sold.`,
        body: table([["Order", o.code], ["Your earnings", o.net]]) +
          "<p style='margin-top:10px'>Deliver quickly to keep your rating high.</p>",
        cta: { label: "Deliver now", href: "/seller/orders" },
      }),
    }),

  /** KYC decision — seller@ */
  /** Generic notice — used for buyer KYC and any one-off admin alert. */
  notice: (to: string, o: { title: string; body: string; href?: string; cta?: string; mailbox?: keyof typeof MAILBOXES; tag?: string }) =>
    sendMail({
      to,
      from: o.mailbox ?? "security",
      tags: [o.tag ?? "kyc"],
      subject: o.title,
      html: layout({
        title: o.title,
        intro: o.body,
        body: "",
        cta: o.href ? { label: o.cta ?? "Open G2X", href: o.href } : undefined,
      }),
    }),

  /** Buyer identity-check decision. */
  buyerKyc: (to: string, decision: "approved" | "rejected" | "resubmit", note?: string) =>
    sendMail({
      to, from: "security", tags: ["kyc"],
      subject:
        decision === "approved"
          ? "Your identity check was approved"
          : "Action needed on your identity check",
      html: layout({
        title: decision === "approved" ? "You're verified ✓" : "We need another look",
        intro:
          decision === "approved"
            ? "Your identity check passed. Deposits and purchases of any amount are now unlocked."
            : decision === "rejected"
            ? "We could not approve the documents you submitted."
            : "We need you to resubmit one or more documents.",
        body: note ? `<p><strong>Reviewer note:</strong> ${esc(note)}</p>` : "",
        cta:
          decision === "approved"
            ? { label: "Continue shopping", href: "/" }
            : { label: "Resubmit documents", href: "/dashboard/verification" },
      }),
    }),

  kycDecision: (to: string, approved: boolean, note?: string) =>
    sendMail({
      to, from: "seller", tags: ["kyc"],
      subject: approved ? "Your seller verification was approved" : "Action needed on your verification",
      html: layout({
        title: approved ? "You're verified ✓" : "We need another look",
        intro: approved
          ? "Your ID check passed. You can now list offers and start selling."
          : "We could not approve your ID documents yet.",
        body: note ? `<p><strong>Reviewer note:</strong> ${esc(note)}</p>` : "",
        cta: approved
          ? { label: "Create your first offer", href: "/seller/offers" }
          : { label: "Resubmit documents", href: "/dashboard/become-seller" },
      }),
    }),

  /** Refund — refund@ */
  refundIssued: (to: string, o: { code: string; amount: string; reason?: string }) =>
    sendMail({
      to, from: "refund", tags: ["refund"],
      subject: `Refund issued for ${o.code}`,
      html: layout({
        title: "Your refund is on its way",
        intro: `${o.amount} has been credited to your G2X wallet for order ${o.code}.`,
        body: o.reason ? `<p><strong>Reason:</strong> ${esc(o.reason)}</p>` : "",
        cta: { label: "View wallet", href: "/dashboard/wallet" },
      }),
    }),

  /** Dispute — disputes@ */
  disputeUpdate: (to: string, d: { code: string; status: string; note?: string }) =>
    sendMail({
      to, from: "disputes", tags: ["dispute"],
      subject: `Dispute ${d.code} — ${d.status}`,
      html: layout({
        title: `Dispute ${d.code} updated`,
        intro: `The status is now: ${d.status}.`,
        body: d.note ? `<p>${esc(d.note)}</p>` : "",
        cta: { label: "Open dispute", href: "/dashboard/disputes" },
      }),
    }),

  /** Payout — billing@ */
  payout: (to: string, w: { amount: string; status: string; note?: string }) =>
    sendMail({
      to, from: "billing", tags: ["payout"],
      subject: `Withdrawal ${w.status} — ${w.amount}`,
      html: layout({
        title: `Payout ${w.status}`,
        intro: `Your withdrawal of ${w.amount} is ${w.status}.`,
        body: w.note ? `<p>${esc(w.note)}</p>` : "",
        cta: { label: "View finances", href: "/seller/finance" },
      }),
    }),

  /** Security — security@ */
  securityAlert: (to: string, s: { title: string; detail: string }) =>
    sendMail({
      to, from: "security", tags: ["security"],
      subject: s.title,
      html: layout({
        title: s.title,
        intro: s.detail,
        body: "<p>If this wasn't you, change your password immediately and enable two-factor authentication.</p>",
        cta: { label: "Review security settings", href: "/dashboard/security" },
        footnote: "Sent by the G2X security team.",
      }),
    }),

  /** Support ticket reply — support@ */
  ticketReply: (to: string, t: { code: string; body: string }) =>
    sendMail({
      to, from: "support", tags: ["support"],
      subject: `Re: your ticket ${t.code}`,
      html: layout({
        title: `We replied to ${t.code}`,
        body: `<p>${esc(t.body)}</p>`,
        cta: { label: "View conversation", href: "/support" },
      }),
    }),

  /** Wallet top-up receipt — billing@ */
  walletTopUp: (to: string, w: { amount: string; method: string; fee: string; balance: string }) =>
    sendMail({
      to, from: "billing", tags: ["wallet"],
      subject: `Wallet topped up — ${w.amount}`,
      html: layout({
        title: "Funds added to your wallet",
        intro: `${w.amount} is now available in your G2X wallet.`,
        body: table(
          [
            ["Amount added", w.amount],
            ["Paid with", w.method],
            ...(w.fee ? ([["Gateway fee", w.fee]] as [string, string][]) : []),
            ["New balance", w.balance],
          ]
        ),
        cta: { label: "Go shopping", href: "/" },
      }),
    }),

  /** Seller must act — seller@. Sent the moment payment clears. */
  actionRequired: (to: string, o: { code: string; title: string; qty: number; uid: string; deadline: string }) =>
    sendMail({
      to, from: "seller", tags: ["sale"],
      subject: `Action required — deliver order ${o.code}`,
      html: layout({
        title: "You have an order to deliver ⚡",
        intro: `Payment for ${o.code} has cleared. Please deliver as soon as you can.`,
        body:
          table([
            ["Order", o.code],
            ["Item", o.title],
            ["Quantity", String(o.qty)],
            ["Buyer's game ID", o.uid || "—"],
            ["Deliver before", o.deadline],
          ]) +
          "<p style='margin-top:10px'>Fast delivery protects your rating and seller level.</p>",
        cta: { label: "Deliver now", href: "/seller/orders" },
        footnote: "Never take payment or contact outside G2X — it voids protection for both sides.",
      }),
    }),

  /** Buyer confirmed receipt; escrow released — billing@ */
  paymentReleased: (to: string, o: { code: string; net: string }) =>
    sendMail({
      to, from: "billing", tags: ["payout"],
      subject: `Payment released for ${o.code}`,
      html: layout({
        title: "Funds released to you 🎉",
        intro: `The buyer confirmed order ${o.code}, so escrow has been released.`,
        body: table([["Order", o.code], ["Added to available balance", o.net]]),
        cta: { label: "View finances", href: "/seller/finance" },
      }),
    }),

  /** Order completed — notification@ */
  orderCompleted: (to: string, o: { code: string; title: string }) =>
    sendMail({
      to, from: "notification", tags: ["order"],
      subject: `Order ${o.code} completed`,
      html: layout({
        title: "Your order is complete ✓",
        intro: `${o.title} is done and the seller has been paid.`,
        body: "<p>Thanks for shopping with G2X. Leaving a review helps other buyers and supports good sellers.</p>",
        cta: { label: "Leave a review", href: "/dashboard/reviews" },
      }),
    }),

  /** Order cancelled — notification@ */
  orderCancelled: (to: string, o: { code: string; title: string; reason: string; refund: string }) =>
    sendMail({
      to, from: "notification", tags: ["order"],
      subject: `Order ${o.code} was cancelled`,
      html: layout({
        title: "Your order was cancelled",
        intro: `${o.title} could not be fulfilled.`,
        body:
          table([
            ["Order", o.code],
            ["Reason", o.reason || "Not supplied"],
            ["Refunded to wallet", o.refund],
          ]) + "<p style='margin-top:10px'>The amount is already back in your wallet.</p>",
        cta: { label: "Browse alternatives", href: "/" },
      }),
    }),

  /** A dispute was just opened — disputes@ to both sides */
  disputeOpened: (to: string, d: { code: string; order: string; reason: string; forSeller: boolean }) =>
    sendMail({
      to, from: "disputes", tags: ["dispute"],
      subject: `Dispute ${d.code} opened on order ${d.order}`,
      html: layout({
        title: d.forSeller ? "A buyer opened a dispute" : "Your dispute was opened",
        intro: d.forSeller
          ? `Order ${d.order} is now under dispute. Please respond within 24 hours.`
          : `We have received your dispute for order ${d.order}.`,
        body: table([["Dispute", d.code], ["Order", d.order], ["Reason", d.reason]]),
        cta: {
          label: d.forSeller ? "Respond now" : "View dispute",
          href: d.forSeller ? "/seller/disputes" : "/dashboard/disputes",
        },
      }),
    }),

  /** New message in a thread — notification@ */
  newMessage: (to: string, m: { from: string; preview: string; href: string }) =>
    sendMail({
      to, from: "notification", tags: ["message"],
      subject: `New message from ${m.from}`,
      html: layout({
        title: `${m.from} sent you a message`,
        body: `<p style="padding:10px 12px;background:#0f0f18;border-radius:8px">${esc(m.preview)}</p>`,
        cta: { label: "Reply", href: m.href },
        footnote: "All chats are monitored by G2X admins for your protection.",
      }),
    }),

  /** Seller application received — seller@ */
  sellerApplied: (to: string, name: string) =>
    sendMail({
      to, from: "seller", tags: ["kyc"],
      subject: "We received your seller application",
      html: layout({
        title: `Thanks, ${name} — application received`,
        intro: "Our team reviews ID documents within 24–48 hours.",
        body: "<p>You will get an email the moment a decision is made.</p>",
        cta: { label: "Check status", href: "/dashboard/become-seller" },
      }),
    }),

  /** Withdrawal requested — billing@ */
  withdrawalRequested: (to: string, w: { amount: string; method: string }) =>
    sendMail({
      to, from: "billing", tags: ["payout"],
      subject: `Withdrawal requested — ${w.amount}`,
      html: layout({
        title: "Withdrawal request received",
        intro: `We are reviewing your request for ${w.amount}.`,
        body: table([["Amount", w.amount], ["Method", w.method]]),
        cta: { label: "View finances", href: "/seller/finance" },
      }),
    }),

  /** New support ticket — support@ */
  ticketCreated: (to: string, t: { code: string; subject: string }) =>
    sendMail({
      to, from: "support", tags: ["support"],
      subject: `Ticket ${t.code} received — ${t.subject}`,
      html: layout({
        title: `We got your ticket ${t.code}`,
        intro: "Our support team usually replies within a few hours.",
        body: table([["Ticket", t.code], ["Subject", t.subject]]),
        cta: { label: "View ticket", href: "/support" },
      }),
    }),

  /** Low stock nudge — seller@ */
  lowStock: (to: string, o: { title: string; left: number }) =>
    sendMail({
      to, from: "seller", tags: ["sale"],
      subject: `Low stock — ${o.title}`,
      html: layout({
        title: "You are running low",
        intro: `${o.title} has only ${o.left} left.`,
        body: "<p>Restock now so your offer keeps selling and stays ranked.</p>",
        cta: { label: "Update stock", href: "/seller/offers" },
      }),
    }),

  /** Sales / business enquiry — sales@ */
  salesEnquiry: (to: string, name: string) =>
    sendMail({
      to, from: "sales", tags: ["sales"],
      subject: "Thanks for contacting G2X",
      html: layout({
        title: `Hi ${name}, we got your message`,
        intro: "Our partnerships team will reply within one business day.",
        body: "<p>In the meantime, feel free to browse the marketplace.</p>",
        cta: { label: "Visit G2X", href: "/" },
      }),
    }),
};
