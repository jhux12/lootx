import { MysteryBox } from '../types';

export const normalizeBoxTag = (tag: string) => tag.trim().toLowerCase();

export const getBoxTags = (box: MysteryBox) => {
  const tags = new Set<string>();
  if (box.tag) tags.add(normalizeBoxTag(box.tag));
  (box.tags ?? []).forEach((tag) => {
    const normalized = normalizeBoxTag(tag);
    if (normalized) tags.add(normalized);
  });
  return Array.from(tags);
};
