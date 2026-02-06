type SiteSearchEntry = {
  title: string;
  keywords: string[];
  content: string;
};

const SITE_SEARCH_ENTRIES: SiteSearchEntry[] = [
  {
    title: 'Depositing coins',
    keywords: ['deposit', 'top up', 'topup', 'coins', 'pack', 'package', 'stripe', 'checkout'],
    content:
      'Use the Top up flow to choose a coin package and complete checkout. Select a pack, then deposit to start Stripe Checkout. You must be signed in to continue. By depositing you agree to the Terms of Service.'
  },
  {
    title: 'Shipping and tracking',
    keywords: ['ship', 'shipment', 'tracking', 'track', 'address', 'inventory', 'shipping'],
    content:
      'In Inventory, you can ship items or sell them back for coins. Select items and review shipping, then ship an item to start tracking its progress. Once items are shipped, tracking details appear in the Shipped tab with a tracking number.'
  },
  {
    title: 'Case Battles',
    keywords: ['battle', 'case battle', 'arena', 'versus', 'round'],
    content:
      'Case Battles let players open the same cases and the highest total wins. The battle arena is a core gameplay mode on Pullz.gg.'
  },
  {
    title: 'Case Lab',
    keywords: ['case lab', 'custom case', 'custom', 'create', 'odds'],
    content:
      'Case Lab lets you create custom cases with specific odds and publish them for others to open.'
  },
  {
    title: 'Provably fair',
    keywords: ['provably fair', 'fair', 'fairness', 'verify', 'random'],
    content:
      'Outcomes are provably fair and can be verified. Pullz.gg uses fair randomness for openings.'
  }
];

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

export const buildSiteSearchContext = (query: string, limit = 3) => {
  const tokens = tokenize(query);
  if (tokens.length === 0) return '';

  const results = SITE_SEARCH_ENTRIES.map((entry) => {
    const keywordHit = entry.keywords.some((keyword) =>
      tokens.some((token) => keyword.toLowerCase().includes(token) || token.includes(keyword.toLowerCase()))
    );
    const tokenHitCount = tokens.filter((token) => entry.content.toLowerCase().includes(token)).length;
    const score = (keywordHit ? 4 : 0) + tokenHitCount;
    return { entry, score };
  })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => `- ${entry.title}: ${entry.content}`)
    .join('\n');

  return results ? `SITE_SEARCH_RESULTS:\n${results}` : '';
};
