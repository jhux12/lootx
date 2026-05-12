export async function getTcgplayerPrice(item) {
  const apiKey = process.env.TCGPLAYER_API_KEY;
  if (!apiKey) {
    throw new Error('TCGPLAYER_API_KEY is not configured. Add the server-side env var before enabling TCGplayer updates.');
  }

  const pricing = item.marketPricing || {};
  const search = pricing.sourceId || pricing.query || item.name;
  if (!search) throw new Error('TCGplayer lookup requires sourceId, query, or item name.');

  // Placeholder for the real TCGplayer API integration. Keep OAuth/client secrets server-side only.
  throw new Error(`TCGplayer provider placeholder is configured but no live mapping exists yet for "${search}".`);
}
