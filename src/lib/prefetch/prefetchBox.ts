import { MysteryBox } from '../../../types';
import { IntentCache } from './cache';

const boxPrefetchCache = new IntentCache<MysteryBox | null>();

const preloadImage = (imageUrl?: string) => {
  if (!imageUrl) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = imageUrl;
};

export const prefetchBox = async (
  boxId: string,
  fetcher: () => Promise<MysteryBox | null>,
  heroImageUrl?: string
) => {
  const box = await boxPrefetchCache.getOrLoad(boxId, fetcher, 60_000);
  preloadImage(heroImageUrl || box?.image);
  return box;
};
