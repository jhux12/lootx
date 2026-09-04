import type { MysteryBox } from '../../types';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { getBoxTags } from '../../utils/boxTags';

export type BoxSortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'trending';

export const BOX_SORT_OPTIONS: Array<{ id: BoxSortOption; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'trending', label: 'Trending' },
  { id: 'newest', label: 'Newest' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' }
];

const score = (box: MysteryBox) => {
  const prices = box.items.map((item) => Number(item.price) || 0).sort((a, b) => b - a);
  const tags = getBoxTags(box);
  return {
    featured: (prices[0] ?? 0) + box.items.filter((item) => item.rarity === 'legendary' || item.rarity === 'epic').length * 5_000 + (tags.includes('featured') ? 250_000 : 0),
    trending: prices.slice(0, 3).reduce((sum, value) => sum + value, 0) + (Number(box.createdAt) || 0) / 1000 + (tags.includes('trending') ? 400_000 : 0)
  };
};

export const sortBoxes = (boxes: MysteryBox[], option: BoxSortOption) => [...boxes].sort((left, right) => {
  if (option === 'price-asc') return toCoins(left.price, PRICE_UNIT_MODE) - toCoins(right.price, PRICE_UNIT_MODE);
  if (option === 'price-desc') return toCoins(right.price, PRICE_UNIT_MODE) - toCoins(left.price, PRICE_UNIT_MODE);
  if (option === 'newest') return (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0);
  const leftScore = score(left);
  const rightScore = score(right);
  return option === 'trending' ? rightScore.trending - leftScore.trending : rightScore.featured - leftScore.featured;
});
