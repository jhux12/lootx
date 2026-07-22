import { MysteryBox } from '../../../types';
import { IntentCache } from './cache';

const boxPrefetchCache = new IntentCache<MysteryBox | null>();
const imagePrefetches = new Set<string>();
let caseChunkPrefetch: Promise<unknown> | null = null;

const connection = () => (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection);

const getEffectiveConnection = () => connection()?.effectiveType;

const shouldSkipPrefetch = () => {
  const currentConnection = connection();
  return currentConnection?.saveData === true || currentConnection?.effectiveType === '2g' || currentConnection?.effectiveType === 'slow-2g';
};

const shouldSkipItemImages = () => getEffectiveConnection() === '3g';

const premiumRarityRank = (rarity?: string) => {
  const value = String(rarity ?? '').toLowerCase();
  if (value.includes('legend')) return 2;
  if (value.includes('epic')) return 1;
  return 0;
};

const preloadImage = (imageUrl?: string) => {
  if (!imageUrl || typeof Image === 'undefined' || imagePrefetches.has(imageUrl) || shouldSkipPrefetch()) return;
  imagePrefetches.add(imageUrl);
  const image = new Image();
  image.decoding = 'async';
  image.loading = 'eager';
  image.src = imageUrl;
};

const prefetchCaseChunk = () => {
  if (caseChunkPrefetch || shouldSkipPrefetch()) return;
  caseChunkPrefetch = import('../../../components/CaseOpening').catch(() => null);
};

export const prefetchBox = async (
  boxId: string,
  fetcher: () => Promise<MysteryBox | null>,
  heroImageUrl?: string
) => {
  if (shouldSkipPrefetch()) return null;
  prefetchCaseChunk();
  const box = await boxPrefetchCache.getOrLoad(boxId, fetcher, 60_000).catch(() => null);
  preloadImage(heroImageUrl || box?.image);
  if (!shouldSkipItemImages()) {
    box?.items
      .slice()
      // Match the opening reel: warm the most visible premium drops first.
      .sort((a, b) => premiumRarityRank(b.rarity) - premiumRarityRank(a.rarity) || b.price - a.price)
      .slice(0, 3)
      .forEach((item) => {
        const itemWithThumbnail = item as typeof item & { thumbnail?: string; thumbnailUrl?: string; imageThumb?: string };
        preloadImage(itemWithThumbnail.thumbnailUrl || itemWithThumbnail.thumbnail || itemWithThumbnail.imageThumb || item.image);
      });
  }
  return box;
};
