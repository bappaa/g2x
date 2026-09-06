import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getCart } from "@/lib/queries";
import { Breadcrumb, Empty, Btn } from "@/components/ui";
import CartView from "@/components/shop/CartView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Cart — G2X.GG" };

export default async function CartPage() {
  const u = await getSessionUser();
  const items = u ? await getCart(u.id) : [];

  return (
    <main className="mx-auto max-w-[1100px] px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <h1 className="mt-4 text-[20px] font-black sm:text-[26px] tracking-tight">Your Cart</h1>

      {!u ? (
        <div className="mt-5">
          <Empty
            title="Sign in to view your cart"
            sub="Your cart is saved to your account so it follows you across devices."
            action={
              <Link href="/login?next=/cart">
                <Btn>Sign in</Btn>
              </Link>
            }
          />
        </div>
      ) : (
        <CartView items={items} />
      )}
    </main>
  );
}
