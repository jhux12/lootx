import { getPriceChartingPrice } from './providers/pricecharting.js';
import { getTcgplayerPrice } from './providers/tcgplayer.js';

const toFiniteUsd = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('Market provider returned an invalid price.');
  return Math.round(numeric * 100) / 100;
};

export async function getMarketPrice(item) {
  const pricing = item.marketPricing || {};
  const source = pricing.source || 'manual';

  if (source === 'manual') {
    const manualValue = pricing.approvedValueUsd ?? pricing.suggestedValueUsd ?? item.valueUsd ?? (Number(item.price ?? item.valueCoins ?? 0) / 100);
    return { source: 'manual', sourceId: pricing.sourceId, valueUsd: toFiniteUsd(manualValue), raw: { manual: true } };
  }

  if (source === 'pricecharting') return getPriceChartingPrice(item);
  if (source === 'tcgplayer') return getTcgplayerPrice(item);
  throw new Error(`Unsupported market pricing source: ${source}`);
}
