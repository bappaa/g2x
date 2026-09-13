"use client";
import {
  User, PlusCircle, CircleDollarSign, Rocket, Crown, Package,
  Gamepad2, Coins, Zap, Star, ShieldCheck, Gift, Sparkles, Trophy,
  Ticket, Wallet, Shirt, Swords,
} from "lucide-react";

/**
 * Resolves the icon name stored on a category/CMS row to a component.
 * Admins type a name (e.g. "rocket"); unknown names fall back per-slug,
 * then to a generic icon — so a category can never render broken.
 */
const MAP: Record<string, React.ElementType> = {
  user: User, account: User, accounts: User,
  plus: PlusCircle, pluscircle: PlusCircle, topup: PlusCircle, "top-up": PlusCircle,
  dollar: CircleDollarSign, currency: CircleDollarSign, coins: Coins, coin: Coins,
  rocket: Rocket, boosting: Rocket, boost: Rocket,
  crown: Crown, subscription: Crown, subscriptions: Crown,
  package: Package, items: Package, item: Package,
  gamepad: Gamepad2, game: Gamepad2, games: Gamepad2,
  zap: Zap, instant: Zap, star: Star, shield: ShieldCheck,
  gift: Gift, sparkles: Sparkles, trophy: Trophy, ticket: Ticket,
  wallet: Wallet, skin: Shirt, skins: Shirt, swords: Swords,
};

const COLORS: Record<string, string> = {
  accounts: "#3b82f6", "top-up": "#22c55e", currency: "#eab308",
  boosting: "#ef4444", subscriptions: "#a855f7", items: "#8b5cf6",
};

const hueOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 72% 58%)`;
};

export function CategoryIcon({
  name, slug, size = 38, color,
}: {
  name?: string | null; slug: string; size?: number; color?: string;
}) {
  const key = (name ?? "").toLowerCase().replace(/[^a-z-]/g, "");
  const Icon = MAP[key] ?? MAP[slug] ?? Gamepad2;
  return (
    <Icon
      size={size}
      strokeWidth={1.6}
      className="mx-auto"
      style={{ color: color ?? COLORS[slug] ?? hueOf(slug) }}
    />
  );
}
