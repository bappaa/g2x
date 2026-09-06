/**
 * Chat moderation.
 *
 * Detects sellers/buyers trying to move a deal off-platform (which dodges our
 * commission and voids buyer protection). Messages are never blocked outright —
 * they are scored, flagged, and surfaced to admins in /admin/messages.
 */

export type Flag = { code: string; label: string; severity: 1 | 2 | 3 };

const RULES: { code: string; label: string; severity: 1 | 2 | 3; re: RegExp }[] = [
  {
    code: "email",
    label: "Email address shared",
    severity: 3,
    re: /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\s+at\s+)\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+)\s*[a-z]{2,}/i,
  },
  {
    code: "phone",
    label: "Phone number shared",
    severity: 3,
    re: /(?:\+?\d[\s\-().]?){9,15}/,
  },
  {
    code: "social",
    label: "Social / messenger handle",
    severity: 3,
    re: /\b(whats\s?app|wa\.me|telegram|t\.me|discord|insta(?:gram)?|snap(?:chat)?|skype|signal|messenger|wechat|viber|line\s?id|imo)\b/i,
  },
  {
    code: "external_url",
    label: "External link",
    severity: 2,
    re: /\b(?:https?:\/\/|www\.)(?!(?:[a-z0-9-]+\.)?g2x\.gg)[a-z0-9-]+\.[a-z]{2,}/i,
  },
  {
    code: "offsite_payment",
    label: "Off-platform payment",
    severity: 3,
    re: /\b(paypal|upi|gpay|google\s?pay|phonepe|paytm|venmo|cash\s?app|zelle|western\s?union|bank\s?transfer|ifsc|iban|usdt|btc|bitcoin|binance|crypto\s?wallet)\b/i,
  },
  {
    code: "evade",
    label: "Suggests leaving the platform",
    severity: 3,
    re: /\b(outside|off)\s*(?:of\s*)?(?:the\s*)?(?:site|platform|g2x)\b|\bdirect(?:ly)?\s+(?:deal|pay|buy|sell|contact)\b|\bavoid\s+(?:the\s+)?(?:fee|commission|tax)\b|\bcheaper\s+(?:if|when)\s+(?:you\s+)?(?:we\s+)?(?:go|deal|pay)\b|\bmy\s+own\s+(?:site|website|shop|store)\b|\bcontact\s+me\s+(?:on|at|via)\b/i,
  },
  {
    code: "no_fee",
    label: "Commission avoidance",
    severity: 3,
    re: /\b(no|without|skip|save|dodge)\s+(?:the\s+)?(?:g2x\s+)?(?:commission|fees?|charges?|cut)\b/i,
  },
];

export type ModerationResult = {
  flagged: boolean;
  score: number;
  flags: Flag[];
};

export function moderateMessage(body: string): ModerationResult {
  const flags: Flag[] = [];
  for (const r of RULES) {
    if (r.re.test(body)) flags.push({ code: r.code, label: r.label, severity: r.severity });
  }
  const score = flags.reduce((s, f) => s + f.severity, 0);
  return { flagged: flags.length > 0, score, flags };
}

/** Masks detected contact info so buyers/sellers see a warning instead. */
export function maskContacts(body: string): string {
  return body
    .replace(RULES[0].re, "[contact hidden]")
    .replace(RULES[1].re, (m) => (m.replace(/\D/g, "").length >= 9 ? "[number hidden]" : m));
}

export const MONITOR_NOTICE =
  "Messages are monitored by G2X admins. Sharing contact details or trading off-platform voids buyer protection and can get your account banned.";
