import { MysteryBox } from '../../../types';
import { IntentCache } from './cache';

const boxPrefetchCache = new IntentCache<MysteryBox | null>();
const imagePrefetches = new Set<string>();
let caseChunkPrefetch: Promise<unknown> | null = null;

const connection = () => (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection);

const shouldSkipPrefetch = () => {
  const currentConnection = connection();
  return currentConnection?.saveData === true || currentConnection?.effectiveType === '2g' || currentConnection?.effectiveType === 'slow-2g';
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
  box?.items.slice(0, 8).forEach((item) => preloadImage(item.image));
  return box;
};
