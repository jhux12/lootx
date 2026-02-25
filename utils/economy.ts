export interface EconomySettings {
  xpPerDollar: number;
  coinsPerDollar: number;
  xpOpenEnabled: boolean;
}

export const DEFAULT_ECONOMY_SETTINGS: EconomySettings = {
  xpPerDollar: 250,
  coinsPerDollar: 100,
  xpOpenEnabled: true
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizeEconomySettings = (settings?: Partial<EconomySettings> | null): EconomySettings => ({
  xpPerDollar: toPositiveNumber(settings?.xpPerDollar, DEFAULT_ECONOMY_SETTINGS.xpPerDollar),
  coinsPerDollar: toPositiveNumber(settings?.coinsPerDollar, DEFAULT_ECONOMY_SETTINGS.coinsPerDollar),
  xpOpenEnabled: settings?.xpOpenEnabled !== false
});

export const getXpCost = (priceCoins: number, settings?: Partial<EconomySettings> | null): number => {
  const normalized = normalizeEconomySettings(settings);
  const safePriceCoins = Number.isFinite(Number(priceCoins)) ? Math.max(0, Number(priceCoins)) : 0;
  if (safePriceCoins <= 0) return 0;

  return Math.max(
    1,
    Math.round((safePriceCoins / normalized.coinsPerDollar) * normalized.xpPerDollar)
  );
};
