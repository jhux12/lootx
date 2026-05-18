export const SHIPPING_RATE_TIERS = [
  { maxValueCoinsExclusive: 2_000, cashCents: 399, label: '<$20' },
  { maxValueCoinsExclusive: 7_500, cashCents: 699, label: '$20–$75' },
  { maxValueCoinsExclusive: Infinity, cashCents: 1_299, label: '$75+' }
] as const;

export const COINS_PER_DOLLAR = 100;

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
