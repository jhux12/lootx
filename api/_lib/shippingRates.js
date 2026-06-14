export const SHIPPING_RATE_TIERS = [
  { maxValueCoinsExclusive: 2000, cashCents: 399, label: '<$20' },
  { maxValueCoinsExclusive: 7500, cashCents: 699, label: '$20–$75' },
  { maxValueCoinsExclusive: Number.POSITIVE_INFINITY, cashCents: 1299, label: '$75+' }
];

export const SHIPPING_PROTECTION_TIERS = [
  { maxValueCoinsExclusive: 10000, cashCents: 99, label: 'Under $100' },
  { maxValueCoinsExclusive: 25000, cashCents: 199, label: '$100–$250' },
  { maxValueCoinsExclusive: Number.POSITIVE_INFINITY, cashCents: 299, label: '$250+' }
];

export const SIGNATURE_REQUIRED_CENTS = 399;

export const getShipmentShippingRate = (shipmentValueCoins) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const tier = SHIPPING_RATE_TIERS.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? SHIPPING_RATE_TIERS[SHIPPING_RATE_TIERS.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};


export const getShippingProtectionRate = (shipmentValueCoins) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const tier = SHIPPING_PROTECTION_TIERS.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? SHIPPING_PROTECTION_TIERS[SHIPPING_PROTECTION_TIERS.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};
