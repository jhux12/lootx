/** Trusted-only projection: never copy prizes, items, audits, or admin metadata. */
export const toBoxSummary = (id, source = {}) => ({
  id,
  name: typeof source.name === 'string' ? source.name : 'Mystery Pack',
  price: Number(source.price || 0),
  ...(source.priceXP == null ? {} : { priceXP: Number(source.priceXP) }),
  currencyType: source.currencyType === 'XP' ? 'XP' : 'COIN',
  image: typeof source.image === 'string' ? source.image : '',
  accentColor: typeof source.accentColor === 'string' ? source.accentColor : '#3b82f6',
  ...(typeof source.tag === 'string' ? { tag: source.tag } : {}),
  ...(Array.isArray(source.tags) ? { tags: source.tags.filter((tag) => typeof tag === 'string') } : {}),
  isDaily: source.isDaily === true,
  isPullPassBox: source.isPullPassBox === true,
  ...(source.pullPassBoxType ? { pullPassBoxType: source.pullPassBoxType } : {}),
  ...(source.sortOrder == null ? {} : { sortOrder: Number(source.sortOrder) }),
  ...(source.publishedAt == null ? {} : { publishedAt: source.publishedAt }),
  ...(source.createdAt == null ? {} : { createdAt: source.createdAt })
});
