import { MysteryBox } from '../types';

export const normalizeBoxTag = (tag: string) => tag.trim().toLowerCase();

const BOX_TAG_ICON_PATTERN = /^<i\s+class=(['"])([^'"]+)\1\s*><\/i>$/i;

export const getBoxTagIconClass = (tag: string) => {
  const raw = tag.trim();
  const match = raw.match(BOX_TAG_ICON_PATTERN);
  if (!match) return null;

  const className = match[2].trim().replace(/\s+/g, ' ');
  const tokens = className.split(' ').filter(Boolean);
  const hasFontAwesomeToken = tokens.some((token) => token.startsWith('fa-') || token === 'fa');
  if (!hasFontAwesomeToken) return null;

  return className;
};

export const isBoxTagIcon = (tag: string) => getBoxTagIconClass(tag) !== null;

export const getBoxTagLabel = (tag: string) => {
  const iconClass = getBoxTagIconClass(tag);
  if (!iconClass) return tag;

  const iconToken = iconClass
    .split(' ')
    .find((token) => token.startsWith('fa-') && !['fa', 'fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-thin', 'fa-duotone'].includes(token));

  if (!iconToken) return 'Icon';

  return iconToken
    .replace(/^fa-/, '')
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
};

export const getBoxTags = (box: MysteryBox) => {
  const tags = new Set<string>();
  if (box.tag) tags.add(normalizeBoxTag(box.tag));
  (box.tags ?? []).forEach((tag) => {
    const normalized = normalizeBoxTag(tag);
    if (normalized) tags.add(normalized);
  });
  return Array.from(tags);
};
