export type PriceUnitMode = 'coins' | 'usd';

export const PRICE_UNIT_MODE: PriceUnitMode = 'usd';

export const toCoins = (value: number, mode: PriceUnitMode) =>
  mode === 'usd' ? Math.round(value * 100) : Math.round(value);
