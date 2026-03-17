import { MysteryBox } from '../types';

export const normalizeBoxTag = (tag: string) => tag.trim().toLowerCase();

const BOX_TAG_ICON_PATTERN = /^<i\s+class=(['"])([^'"]+)\1\s*><\/i>$/i;
const FONT_AWESOME_STYLE_TOKENS = new Set(['fa', 'fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-thin', 'fa-duotone']);

export const sanitizeFontAwesomeClass = (value: string) => {
  const trimmed = value.trim();
  const fromHtml = trimmed.match(BOX_TAG_ICON_PATTERN)?.[2] ?? trimmed;
  const className = fromHtml.replace(/\s+/g, ' ').trim();
  if (!className) return '';

  const tokens = className.split(' ').filter(Boolean);
  const hasStyleToken = tokens.some((token) => FONT_AWESOME_STYLE_TOKENS.has(token));
  const hasIconToken = tokens.some((token) => token.startsWith('fa-') && !FONT_AWESOME_STYLE_TOKENS.has(token));
  if (!hasStyleToken || !hasIconToken) return '';

  return tokens.join(' ');
};

export const getTagIconLabelFromClass = (iconClass: string) => {
  const iconToken = iconClass
    .split(' ')
    .find((token) => token.startsWith('fa-') && !FONT_AWESOME_STYLE_TOKENS.has(token));

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
