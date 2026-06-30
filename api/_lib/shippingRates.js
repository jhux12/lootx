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

const normalizeRateTiers = (tiers, fallback) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return fallback;

  const normalized = tiers
    .map((tier) => ({
      maxValueCoinsExclusive: tier?.maxValueCoinsExclusive === null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, Math.round(Number(tier?.maxValueCoinsExclusive) || 0)),
      cashCents: Math.max(0, Math.round(Number(tier?.cashCents) || 0)),
      label: typeof tier?.label === 'string' && tier.label.trim() ? tier.label.trim() : 'Custom tier'
    }))
    .filter((tier) => tier.maxValueCoinsExclusive === Number.POSITIVE_INFINITY || tier.maxValueCoinsExclusive > 0)
    .sort((a, b) => a.maxValueCoinsExclusive - b.maxValueCoinsExclusive);

  return normalized.length > 0 ? normalized : fallback;
};

export const getShipmentShippingRate = (shipmentValueCoins, tiers) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const rateTiers = normalizeRateTiers(tiers, SHIPPING_RATE_TIERS);
  const tier = rateTiers.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? rateTiers[rateTiers.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};

export const getShippingProtectionRate = (shipmentValueCoins, tiers) => {
  const safeValueCoins = Math.max(0, Math.round(Number(shipmentValueCoins) || 0));
  const rateTiers = normalizeRateTiers(tiers, SHIPPING_PROTECTION_TIERS);
  const tier = rateTiers.find((entry) => safeValueCoins < entry.maxValueCoinsExclusive) ?? rateTiers[rateTiers.length - 1];
  return {
    cashCents: tier.cashCents,
    coinCost: tier.cashCents,
    tierLabel: tier.label
  };
};

export const getSignatureRequiredCents = (settings = {}) => Math.max(
  0,
  Math.round(Number(settings.signatureRequiredCents ?? SIGNATURE_REQUIRED_CENTS) || 0)
);
