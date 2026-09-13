"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, LifeBuoy, MessageSquare, Mail, Check, Loader2, ShieldCheck, Gavel, FileText,
} from "lucide-react";
import { Breadcrumb, Section, Btn, Field, inputCls, Tag } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { createTicketAction } from "@/lib/actions/shop";
import LocalTime from "@/components/LocalTime";

const faqs: [string, string][] = [
  ["How fast is delivery?", "Most top-ups and currency orders are delivered in 5–30 minutes. Accounts and codes are usually instant. Boosting depends on the service ETA shown on the product page."],
  ["Is my payment safe?", "Yes. Every payment is held in G2X escrow and only released to the seller after you confirm you received your product."],
  ["What if the seller doesn't deliver?", "Open a dispute from your order page within 24 hours. Our team reviews the evidence and refunds you if the seller is at fault."],
  ["Can I get a refund?", "Refunds are available for undelivered or incorrect orders. Successfully delivered digital goods are non-refundable unless a valid dispute is upheld."],
  ["Do I need to give my account password?", "Only for services that require account login (e.g. some boosting or VP top-ups). Never share your password in chat outside of an active order."],
  ["How do I become a seller?", "Log in, go to Dashboard → Become a Seller and submit the application. Approval takes 24–48 hours."],
];

const POLICIES = [
  { icon: ShieldCheck, t: "Buyer Protection", d: "Escrow on every order, released only after you confirm delivery." },
  { icon: Gavel, t: "Dispute & Refund Policy", d: "Open within 24h of delivery. Decisions in 1–3 business days." },
  { icon: FileText, t: "Terms, Privacy, Cookies, DMCA", d: "Read the legal terms that govern the marketplace." },
];

type T = { code: string; subject: string; category: string; status: string; created_at: string };

export default function SupportView({ signedIn, tickets }: { signedIn: boolean; tickets: T[] }) {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [subject, setSubject] = useState("");
  const [cat, setCat] = useState("Order Issue");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setErr("");
      const r = await createTicketAction({ subject, category: cat, body });
      if (!r.ok) {
        if (r.error === "AUTH") return router.push("/login?next=/support");
        return setErr(r.error || "Could not create ticket.");
      }
      setSent(true);
      setSubject(""); setBody("");
      setTimeout(() => setSent(false), 2200);
      router.refresh();
    });

  return (
    <main className="mx-auto max-w-[1220px] px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Help Center" }]} />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-4 overflow-hidden rounded-2xl panel p-5 sm:p-7"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-pulseGlow rounded-full bg-brand-600/25 blur-[90px]" />
        <div className="flex items-center gap-2 text-brand-400">
          <LifeBuoy size={16} />
          <span className="text-[11.5px] font-semibold uppercase tracking-widest">24/7 Support</span>
        </div>
        <h1 className="mt-2 text-[18px] font-black sm:text-[30px] tracking-tight">
          How can we <span className="grad-text">help?</span>
        </h1>
        <p className="mt-2 max-w-[540px] text-[13px] muted">
          Browse the FAQ, read our buyer protection policies, or raise a ticket — real humans reply
          within a few hours.
        </p>
      </motion.div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Section title="Frequently asked questions">
            <div className="space-y-2">
              {faqs.map(([q, a], i) => {
                const open = openIdx === i;
                return (
                  <div key={q} className="overflow-hidden rounded-xl soft">
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[12.5px] font-semibold"
                    >
                      {q}
                      <ChevronDown
                        size={14}
                        className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180 text-brand-400" : "muted"}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4"
                        >
                          <p className="pb-3 text-[12px] leading-relaxed muted">{a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Policies & legal">
            <div className="grid gap-3 sm:grid-cols-3">
              {POLICIES.map((p) => (
                <div key={p.t} className="rounded-xl soft p-3.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600/15 text-brand-400">
                    <p.icon size={15} />
                  </span>
                  <div className="mt-2 text-[12.5px] font-bold">{p.t}</div>
                  <div className="mt-0.5 text-[11px] muted">{p.d}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Contact support">
            <div className="space-y-3">
              <Field label="Subject">
                <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Order G2X123456 not delivered" />
              </Field>
              <Field label="Category">
                <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
                  {["Order Issue", "Payment", "Refund", "Account", "Seller", "Other"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Message">
                <textarea rows={4} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe what happened…" />
              </Field>
              {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
              <Btn className="flex w-full items-center justify-center gap-2" disabled={pending} onClick={submit}>
                {pending ? <Loader2 size={14} className="animate-spin" /> : sent ? <Check size={14} /> : <MessageSquare size={14} />}
                {sent ? "Ticket created!" : "Submit ticket"}
              </Btn>
              {!signedIn && (
                <p className="text-[11px] muted">
                  <Link href="/login?next=/support" className="text-brand-400 hover:underline">Sign in</Link> to track your tickets.
                </p>
              )}
            </div>
          </Section>

          {tickets.length > 0 && (
            <Section title="Your tickets">
              {tickets.map((t) => (
                <div key={t.code} className="border-b border-[var(--line)] py-2.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold">{t.subject}</span>
                    <Tag tone={statusTone(t.status)}>{label(t.status)}</Tag>
                  </div>
                  <div className="text-[10.5px] muted">
                    {t.code} · {t.category} · <LocalTime at={t.created_at} />
                  </div>
                </div>
              ))}
            </Section>
          )}

          <Section title="Other ways to reach us">
            <div className="space-y-2 text-[12.5px]">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-brand-500" /> support@g2x.gg
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-brand-500" /> Live chat — bottom right, 24/7
              </div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
