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

export const getShipmentShippingRate = (shipmentValueCoins: number) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const tier = SHIPPING_RATE_TIERS.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? SHIPPING_RATE_TIERS[SHIPPING_RATE_TIERS.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};

export const formatShippingTierSummary = () => '<$20: $3.99 • $20–$75: $6.99 • $75+: $12.99';

export const getShippingProtectionRate = (shipmentValueCoins: number) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const tier = SHIPPING_PROTECTION_TIERS.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? SHIPPING_PROTECTION_TIERS[SHIPPING_PROTECTION_TIERS.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};

export const formatShippingAddOnPrice = (cashCents: number, paymentMethod: 'cash' | 'coins') => (
  paymentMethod === 'cash' ? `$${(cashCents / 100).toFixed(2)}` : `${cashCents.toLocaleString()} coins`
);
