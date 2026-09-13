import { notFound } from "next/navigation";
import { Breadcrumb, Section } from "@/components/ui";

const pages: Record<string, { title: string; body: string[] }> = {
  "about-us": {
    title: "About Us",
    body: [
      "G2X.GG is a trusted digital gaming marketplace connecting buyers with verified sellers of gaming accounts, in-game currency, top-ups, items, boosting services and premium subscriptions.",
      "Founded in 2015, we have served more than 500,000 customers and processed over 2 million orders worldwide. Every transaction on G2X is protected by our escrow system: your money is only released to the seller once you confirm delivery.",
      "Our catalog is curated by the G2X team — we define every game, category and product denomination, while independent sellers compete on price, stock and delivery speed. That means you always get the best available offer.",
    ],
  },
  "how-it-works": {
    title: "How It Works",
    body: [
      "1. Find your game and category — top up, currency, accounts, items, boosting or subscriptions.",
      "2. Pick a product denomination (e.g. 550 PokeCoins) and compare every seller offering it.",
      "3. Choose the offer with the best mix of price, delivery time and seller rating, then check out securely.",
      "4. Provide your in-game UID or login details when prompted. The seller delivers, usually within minutes.",
      "5. Confirm receipt. Only then is the payment released from escrow to the seller. If anything goes wrong, open a dispute within 24 hours.",
    ],
  },
  "buyer-protection": {
    title: "Buyer Protection",
    body: [
      "Every order on G2X.GG is covered by Buyer Protection. Payments are held in escrow and released only after you confirm delivery.",
      "If your order is not delivered, is incomplete or does not match the description, open a dispute from your order page within 24 hours of delivery. Our team reviews the evidence from both sides and issues a full or partial refund where the seller is at fault.",
      "Refunds are returned to your original payment method or your G2X wallet, whichever you prefer.",
    ],
  },
  "terms": {
    title: "Terms & Conditions",
    body: [
      "By accessing G2X.GG you agree to these terms. You must be at least 18 years old, or have parental consent, to purchase on the platform.",
      "Digital goods are non-transferable once delivered. Buying or selling accounts may violate the terms of service of individual games; you accept that risk.",
      "G2X.GG acts as an intermediary and escrow provider between buyers and sellers, and reserves the right to suspend accounts involved in fraud, chargeback abuse or the sale of illegally obtained goods.",
    ],
  },
  "privacy": {
    title: "Privacy Policy",
    body: [
      "We collect only the data required to operate the marketplace: your account details, order history, payment references and support communications.",
      "We never sell personal data. Payment details are processed by PCI-compliant gateways and are not stored on our servers.",
      "You can request an export or deletion of your personal data at any time from Dashboard → Security or by emailing support@g2x.gg.",
    ],
  },
  "refund-policy": {
    title: "Refund Policy",
    body: [
      "Undelivered orders are refunded in full automatically if the seller fails to deliver within the stated delivery window plus a grace period.",
      "Delivered digital goods (codes, credentials, in-game currency) are non-refundable unless a dispute is opened within 24 hours and upheld by our team.",
      "Boosting services can be cancelled pro-rata based on progress completed.",
    ],
  },
  "dispute-policy": {
    title: "Dispute Policy",
    body: [
      "A dispute may be opened by the buyer within 24 hours of delivery, or any time before delivery if the delivery window has elapsed.",
      "The buyer submits evidence, the seller has 24 hours to respond, and a G2X administrator issues a final decision: refund the buyer, release payment to the seller, or split the amount.",
      "Repeated invalid disputes may result in account restrictions.",
    ],
  },
  "cookie-policy": {
    title: "Cookie Policy",
    body: [
      "We use strictly necessary cookies to keep you logged in and remember your cart, plus optional analytics cookies to improve the marketplace.",
      "You can clear or block cookies in your browser; strictly necessary cookies are required for checkout to function.",
    ],
  },
  "dmca": {
    title: "DMCA / Copyright",
    body: [
      "All game names, logos and artwork are the property of their respective owners. G2X.GG is not affiliated with, endorsed by or sponsored by any game publisher.",
      "If you are a rights holder and believe content on G2X.GG infringes your copyright, email dmca@g2x.gg with the details and we will act within 48 hours.",
    ],
  },
  "seller-rules": {
    title: "Seller Rules",
    body: [
      "Sellers must deliver within the delivery window shown on their offer, keep stock accurate, and never request payment outside the platform.",
      "Selling hacked, stolen or chargeback-sourced goods results in a permanent ban and forfeiture of the pending balance.",
      "Commission is deducted automatically per sale and shown as a snapshot on every order.",
    ],
  },
  "fees": {
    title: "Fees",
    body: [
      "Buyers pay a 2% service fee at checkout, shown transparently in the order summary.",
      "Sellers pay a commission on each completed sale; the exact percentage is set per category and displayed in the Seller Panel before you publish an offer.",
      "Withdrawals to UPI, PayPal and bank transfer are free above the minimum payout threshold.",
    ],
  },
  "contact": {
    title: "Contact Us",
    body: [
      "Support: support@g2x.gg — replies within a few hours, 24/7.",
      "Business & partnerships: business@g2x.gg",
      "Copyright: dmca@g2x.gg",
      "You can also open a ticket from the Help Center or use the live chat button in the bottom-right corner.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export default function Page({ params }: { params: { slug: string } }) {
  const p = pages[params.slug];
  if (!p) notFound();
  return (
    <main className="mx-auto max-w-[820px] px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: p.title }]} />
      <h1 className="mt-4 text-[18px] font-black sm:text-[30px] tracking-tight">{p.title}</h1>
      <div className="mt-5">
        <Section>
          <div className="space-y-4">
            {p.body.map((t, i) => (
              <p key={i} className="text-[13px] leading-relaxed muted">
                {t}
              </p>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
