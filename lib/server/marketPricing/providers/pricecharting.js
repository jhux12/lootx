import { MARKET_SOURCES } from '../types.js';

export async function getPriceChartingPrice(item) {
  const apiKey = process.env.PRICECHARTING_API_KEY;
  if (!apiKey) {
    throw new Error('PRICECHARTING_API_KEY is not configured. Add the server-side env var before enabling PriceCharting updates.');
  }

  const pricing = item.marketPricing || {};
  const search = pricing.sourceId || pricing.query || item.name;
  if (!search) throw new Error('PriceCharting lookup requires sourceId, query, or item name.');

  // Placeholder for the real PriceCharting API integration. Keep this server-side only.
  // Example shape: fetch(`https://www.pricecharting.com/api/product?t=${apiKey}&q=${encodeURIComponent(search)}`)
  throw new Error(`PriceCharting provider placeholder is configured but no live mapping exists yet for "${search}".`);
}
