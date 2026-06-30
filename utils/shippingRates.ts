export const SHIPPING_RATE_TIERS = [
  { maxValueCoinsExclusive: 2_000, cashCents: 399, label: '<$20' },
  { maxValueCoinsExclusive: 7_500, cashCents: 699, label: '$20–$75' },
  { maxValueCoinsExclusive: Infinity, cashCents: 1_299, label: '$75+' }
] as const;

export const COINS_PER_DOLLAR = 100;

export const SHIPPING_PROTECTION_TIERS = [
  { maxValueCoinsExclusive: 10_000, cashCents: 99, label: 'Under $100' },
  { maxValueCoinsExclusive: 25_000, cashCents: 199, label: '$100–$250' },
  { maxValueCoinsExclusive: Infinity, cashCents: 299, label: '$250+' }
] as const;

export const SIGNATURE_REQUIRED_CENTS = 399;

export type EditableShippingRateTier = {
  maxValueCoinsExclusive: number | null;
  cashCents: number;
  label: string;
};

const normalizeRateTiers = (tiers: readonly EditableShippingRateTier[] | undefined, fallback: readonly EditableShippingRateTier[]) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return fallback;

  const normalized = tiers
    .map((tier) => ({
      maxValueCoinsExclusive: tier.maxValueCoinsExclusive === null ? Infinity : Math.max(0, Math.round(Number(tier.maxValueCoinsExclusive) || 0)),
      cashCents: Math.max(0, Math.round(Number(tier.cashCents) || 0)),
      label: typeof tier.label === 'string' && tier.label.trim() ? tier.label.trim() : 'Custom tier'
    }))
    .filter((tier) => tier.maxValueCoinsExclusive === Infinity || tier.maxValueCoinsExclusive > 0)
    .sort((a, b) => a.maxValueCoinsExclusive - b.maxValueCoinsExclusive);

  return normalized.length > 0 ? normalized : fallback;
};

export const getShipmentShippingRate = (shipmentValueCoins: number, tiers?: readonly EditableShippingRateTier[]) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const rateTiers = normalizeRateTiers(tiers, SHIPPING_RATE_TIERS);
  const tier = rateTiers.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? rateTiers[rateTiers.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};

export const formatShippingTierSummary = (tiers?: readonly EditableShippingRateTier[]) => normalizeRateTiers(tiers, SHIPPING_RATE_TIERS)
  .map((tier) => `${tier.label}: $${(tier.cashCents / 100).toFixed(2)}`)
  .join(' • ');

export const getShippingProtectionRate = (shipmentValueCoins: number, tiers?: readonly EditableShippingRateTier[]) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const rateTiers = normalizeRateTiers(tiers, SHIPPING_PROTECTION_TIERS);
  const tier = rateTiers.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? rateTiers[rateTiers.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};

export const formatShippingAddOnPrice = (cashCents: number, paymentMethod: 'cash' | 'coins') => (
  paymentMethod === 'cash' ? `$${(cashCents / 100).toFixed(2)}` : `${cashCents.toLocaleString()} coins`
);
