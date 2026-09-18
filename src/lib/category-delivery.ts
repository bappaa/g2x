/**
 * Per-category delivery method presets – mirrors Eldorado UX.
 *
 * Images:
 * 1) Items (Albion) – single fixed "In-game delivery", Guaranteed Delivery Time, Quantity +/- , Volume discount
 * 2) Accounts Auto – Automatic/Manual radio, Account vault (login/pass), no time when Auto
 * 3) Accounts Manual – Automatic/Manual radio, Guaranteed Delivery Time, Quantity fixed 1
 * 4) Currency (Tarkov) – Guaranteed Time + Delivery method BETA with 7 radios (in-game trade, game pass, auction house, mail trade, island delivery, epic gifting, login method), Quantity total+min, Volume discount
 * 5) Gift Cards – Automatic/Manual radio, Gift card vault, Price
 * Boosting – no delivery method, only Guaranteed Time, Price, Quantity fixed 1
 * Top-up – single fixed "Top-up"
 * Subscriptions – like Accounts/Gift Cards Automatic/Manual
 */

export type DeliveryMethodOpt = {
  value: string;
  label: string;
  beta?: boolean;
  hint?: string;
};

export type CategoryDeliveryPreset = {
  slug: string;
  name: string;
  fulfilment: "both" | "manual" | "auto";
  showDeliveryMethods: boolean;
  deliveryMethods: DeliveryMethodOpt[];
  singleFixed: boolean; // if true, show as fixed disabled box, not radio grid
  showGuaranteedTime: boolean | "manual_only";
  quantityMode: "full" | "min_total" | "fixed_1" | "hidden";
  needsTitle: boolean;
  needsImages: boolean;
  needsCredentials: boolean;
  allowVolume: boolean;
  needsQuantity: boolean;
  unitLabel: string;
  description: string;
};

export const DELIVERY_PRESETS: Record<string, CategoryDeliveryPreset> = {
  items: {
    slug: "items",
    name: "Items",
    fulfilment: "manual",
    showDeliveryMethods: true,
    deliveryMethods: [{ value: "in_game_delivery", label: "In-game delivery" }],
    singleFixed: true,
    showGuaranteedTime: true,
    quantityMode: "full",
    needsTitle: true,
    needsImages: true,
    needsCredentials: false,
    allowVolume: true,
    needsQuantity: true,
    unitLabel: "item",
    description: "Item delivery via in-game trade",
  },
  currency: {
    slug: "currency",
    name: "Currency",
    fulfilment: "manual",
    showDeliveryMethods: true,
    deliveryMethods: [
      { value: "in_game_trade", label: "In-game trade", beta: true, hint: "Meet in game to trade currency" },
      { value: "game_pass", label: "Game Pass", beta: true, hint: "Via game pass / private server" },
      { value: "auction_house", label: "Auction House", beta: true, hint: "List item on auction house" },
      { value: "mail_trade", label: "Mail Trade", beta: true, hint: "Send via in-game mail" },
      { value: "island_delivery", label: "Island Delivery", beta: true, hint: "Island / base delivery" },
      { value: "epic_gifting", label: "Epic Gifting", beta: true, hint: "Gift via Epic or platform" },
      { value: "login_method", label: "Login Method", beta: true, hint: "Login to account to deliver" },
    ],
    singleFixed: false,
    showGuaranteedTime: true,
    quantityMode: "min_total",
    needsTitle: false,
    needsImages: false,
    needsCredentials: false,
    allowVolume: true,
    needsQuantity: true,
    unitLabel: "unit",
    description: "Currency delivery methods",
  },
  accounts: {
    slug: "accounts",
    name: "Accounts",
    fulfilment: "both",
    showDeliveryMethods: false,
    deliveryMethods: [],
    singleFixed: false,
    showGuaranteedTime: "manual_only",
    quantityMode: "fixed_1",
    needsTitle: true,
    needsImages: true,
    needsCredentials: true,
    allowVolume: false,
    needsQuantity: false,
    unitLabel: "account",
    description: "Account with Automatic/Manual delivery",
  },
  "gift-cards": {
    slug: "gift-cards",
    name: "Gift Cards",
    fulfilment: "both",
    showDeliveryMethods: false,
    deliveryMethods: [],
    singleFixed: false,
    showGuaranteedTime: "manual_only",
    quantityMode: "hidden", // stock = number of gift cards added
    needsTitle: true,
    needsImages: false,
    needsCredentials: true,
    allowVolume: false,
    needsQuantity: false,
    unitLabel: "code",
    description: "Gift card codes",
  },
  "top-up": {
    slug: "top-up",
    name: "Top Up",
    fulfilment: "manual",
    showDeliveryMethods: true,
    deliveryMethods: [{ value: "top_up", label: "Top-up" }],
    singleFixed: true,
    showGuaranteedTime: true,
    quantityMode: "full",
    needsTitle: false,
    needsImages: false,
    needsCredentials: false,
    allowVolume: false,
    needsQuantity: true,
    unitLabel: "unit",
    description: "Direct top-up to account",
  },
  subscriptions: {
    slug: "subscriptions",
    name: "Subscriptions",
    fulfilment: "both",
    showDeliveryMethods: false,
    deliveryMethods: [],
    singleFixed: false,
    showGuaranteedTime: "manual_only",
    quantityMode: "fixed_1",
    needsTitle: true,
    needsImages: false,
    needsCredentials: true,
    allowVolume: false,
    needsQuantity: false,
    unitLabel: "subscription",
    description: "Subscription codes",
  },
  boosting: {
    slug: "boosting",
    name: "Boosting",
    fulfilment: "manual",
    showDeliveryMethods: false,
    deliveryMethods: [],
    singleFixed: false,
    showGuaranteedTime: true,
    quantityMode: "fixed_1",
    needsTitle: true,
    needsImages: false,
    needsCredentials: false,
    allowVolume: false,
    needsQuantity: false,
    unitLabel: "service",
    description: "Boosting service",
  },
};

export function getPreset(slug: string): CategoryDeliveryPreset | null {
  return DELIVERY_PRESETS[slug] || null;
}

export function allDeliveryMethodValues(): DeliveryMethodOpt[] {
  const map = new Map<string, DeliveryMethodOpt>();
  for (const p of Object.values(DELIVERY_PRESETS)) {
    for (const m of p.deliveryMethods) {
      if (!map.has(m.value)) map.set(m.value, m);
    }
  }
  // add legacy values for backward compat
  const legacy = [
    { value: "automatic", label: "Automatic" },
    { value: "manual", label: "Manual" },
    { value: "in_game_delivery", label: "In-game delivery" },
  ];
  for (const l of legacy) if (!map.has(l.value)) map.set(l.value, l as DeliveryMethodOpt);
  return Array.from(map.values());
}
