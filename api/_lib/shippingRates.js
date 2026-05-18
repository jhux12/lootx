export const SHIPPING_RATE_TIERS = [
  { maxValueCoinsExclusive: 2000, cashCents: 399, label: '<$20' },
  { maxValueCoinsExclusive: 7500, cashCents: 699, label: '$20–$75' },
  { maxValueCoinsExclusive: Number.POSITIVE_INFINITY, cashCents: 1299, label: '$75+' }
];

export const getShipmentShippingRate = (shipmentValueCoins) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const tier = SHIPPING_RATE_TIERS.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? SHIPPING_RATE_TIERS[SHIPPING_RATE_TIERS.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};
