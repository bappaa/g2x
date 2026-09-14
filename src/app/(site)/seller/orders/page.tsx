import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getSellerOrders, countSellerOrders } from "@/lib/queries";
import SellerOrders from "@/components/seller/SellerOrders";
import { sweepEscrowInBackground } from "@/lib/escrow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller Orders — G2X.GG" };

const TABS = ["all", "processing", "delivered", "completed", "cancelled", "disputed"];
const PER_PAGE = 10;

export default async function Page({ searchParams }: { searchParams: { status?: string; q?: string; page?: string } }) {
  sweepEscrowInBackground();
  const u = await requireUser();
  const status = searchParams.status ?? "all";
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const offset = (page - 1) * PER_PAGE;

  const [orders, total] = await Promise.all([
    getSellerOrders(u.id, status, { q: q || undefined, limit: PER_PAGE, offset }),
    countSellerOrders(u.id, status, q || undefined),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Build query string preserving status and q
  const buildHref = (p: number) => {
    const qs = new URLSearchParams();
    if (status && status !== "all") qs.set("status", status);
    if (q) qs.set("q", q);
    if (p > 1) qs.set("page", String(p));
    return `/seller/orders${qs.toString() ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Orders</h1>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "all" ? `/seller/orders${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/seller/orders?status=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
              status === t ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <form action="/seller/orders" method="GET" className="flex gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by order code, product, buyer email..."
          className="h-10 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 text-[12.5px] outline-none focus:border-brand-500 soft"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-500">
          Search
        </button>
        {q && (
          <Link href={buildHref(1).replace(/&?q=[^&]*/, "").replace(/\?$/, "") || "/seller/orders"} className="rounded-lg soft px-3 py-2 text-[12px] font-semibold">
            Clear
          </Link>
        )}
      </form>

      <SellerOrders orders={orders as never} />

      {total > PER_PAGE && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-[11.5px] muted">
            Showing {offset + 1}–{Math.min(offset + PER_PAGE, total)} of {total} orders
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={page <= 1 ? "#" : buildHref(page - 1)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${page <= 1 ? "soft opacity-40 pointer-events-none" : "soft hover:bg-brand-600/10 hover:text-brand-400"}`}
            >
              Previous
            </Link>
            <span className="text-[11.5px] muted">
              Page {page} / {totalPages}
            </span>
            <Link
              href={page >= totalPages ? "#" : buildHref(page + 1)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${page >= totalPages ? "soft opacity-40 pointer-events-none" : "soft hover:bg-brand-600/10 hover:text-brand-400"}`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
