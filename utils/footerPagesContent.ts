import { Timestamp, serverTimestamp } from 'firebase/firestore';

export type FooterPageKey = 'about' | 'faq' | 'terms' | 'privacy' | 'provablyFair' | 'shipping' | 'refund' | 'contact';

export type FooterPageSection = {
  title: string;
  lastUpdated?: Timestamp;
  published: { content: string; version: number };
  draft: { content: string; version: number; updatedAt?: Timestamp };
};

export const FOOTER_PAGE_META: Record<FooterPageKey, { label: string; eyebrow: string }> = {
  about: { label: 'About', eyebrow: 'Pullz.gg Help' },
  faq: { label: 'FAQ', eyebrow: 'Pullz.gg Help' },
  terms: { label: 'Terms', eyebrow: 'Pullz.gg Legal' },
  privacy: { label: 'Privacy', eyebrow: 'Pullz.gg Legal' },
  provablyFair: { label: 'Provably Fair', eyebrow: 'Pullz.gg Fairness' },
  shipping: { label: 'Shipping', eyebrow: 'Pullz.gg Help' },
  refund: { label: 'Refunds', eyebrow: 'Pullz.gg Help' },
  contact: { label: 'Contact', eyebrow: 'Pullz.gg Support' }
};

export const FOOTER_PAGE_KEYS = Object.keys(FOOTER_PAGE_META) as FooterPageKey[];

export const DEFAULT_FOOTER_PAGE_CONTENT: Record<FooterPageKey, { title: string; content: string }> = {
  about: {
    title: 'About Pullz.gg',
    content: `# About Pullz.gg\n\nPullz.gg helps collectors discover Pokémon mystery boxes online with transparent rewards, account tools, and support.\n\n## Our focus\nWe build collectible-focused mystery box experiences with clear reward displays and simple inventory management.\n\n## Collector-first choices\nUsers can keep eligible items for shipment or sell them back for site credit where available.\n\n## Trust and transparency\nPullz.gg provides support resources, legal policies, and provably fair information for users reviewing the platform.\n`
  },
  faq: {
    title: 'FAQ',
    content: `# FAQ\n\nQuick answers about opening Pullz.gg Pokémon mystery boxes, keeping rewards, and using site credit.\n\n## What is Pullz.gg?\nPullz.gg is an online mystery box platform focused on Pokémon collectibles and other reward drops.\n\n## Can I keep the items I win?\nYes. Eligible physical collectibles can be kept and requested for shipment from your inventory.\n\n## Can I sell items back?\nEligible rewards may be sold back for site credit instead of being shipped.\n\n## How do I know openings are fair?\nVisit the Provably Fair page to learn how box results can be verified.\n`
  },
  terms: {
    title: 'Terms of Service',
    content: `# Terms of Service\n\nWelcome to Pullz.gg! These terms outline the rules for using our platform.\n\n## Eligibility\n- You must be at least 18 years old.\n- You are responsible for complying with local laws.\n\n## Accounts\n- Keep your login credentials secure.\n- We may suspend accounts for policy violations.\n\n## Fair Play\n- Automated abuse is prohibited.\n- We reserve the right to investigate suspicious activity.\n\n## Contact\nIf you have questions, reach us at support@pullz.gg.\n`
  },
  privacy: {
    title: 'Privacy Policy',
    content: `# Privacy Policy\n\nWe value your privacy and explain how your data is handled.\n\n## Information we collect\n- Account details (email, username).\n- Gameplay and transaction history.\n\n## How we use data\n- To provide and improve the service.\n- To communicate important updates.\n\n## Your choices\n- You can request account deletion.\n- Update marketing preferences anytime.\n\n## Contact\nQuestions? Email support@pullz.gg.\n`
  },
  provablyFair: {
    title: 'Provably Fair',
    content: `# Provably Fair\n\nPullz.gg uses provably fair tools so users can review how eligible game results are generated.\n\n## How it works\nA server seed hash, client seed, and nonce combine to produce verifiable roll data.\n\n## Verification\nUse the tools below to review your current seed state, rotate seeds, and inspect recent outcomes.\n`
  },
  shipping: {
    title: 'Shipping Policy',
    content: `# Shipping Policy\n\nThis page summarizes how Pullz.gg handles shipment requests for eligible physical collectibles.\n\n## Eligible items\nPhysical items marked as eligible in a user inventory may be requested for shipment.\n\n## Shipping details\nUsers are responsible for providing accurate shipping information before submitting a shipment request.\n\n## Processing\nShipment processing times can vary based on item availability, destination, carrier service, and account review requirements.\n`
  },
  refund: {
    title: 'Refund Policy',
    content: `# Refund Policy\n\nThis page summarizes Pullz.gg refund expectations for purchases, credits, and collectible rewards.\n\n## Digital purchases\nSite credit purchases and used credits are generally final unless required by applicable law or confirmed support review.\n\n## Reward outcomes\nMystery box outcomes are determined when opened and are not refundable because a user did not receive a preferred item.\n\n## Need help?\nContact support if you believe there was a billing issue, duplicate charge, or shipment problem.\n`
  },
  contact: {
    title: 'Contact Support',
    content: `# Contact Support\n\nNeed help with your Pullz.gg account, a purchase, a shipment, or a reward? Complete the form with as much detail as possible.\n\n## Support tips\n- Include order, shipment, or reward names when relevant.\n- Use an email address where our team can reach you.\n- Our team will reply to you by email.\n`
  }
};

export const buildDefaultFooterPagesDoc = () =>
  FOOTER_PAGE_KEYS.reduce((acc, key) => {
    const defaults = DEFAULT_FOOTER_PAGE_CONTENT[key];
    acc[key] = {
      title: defaults.title,
      lastUpdated: serverTimestamp(),
      published: { content: defaults.content, version: 1 },
      draft: { content: defaults.content, version: 1, updatedAt: serverTimestamp() }
    } as FooterPageSection;
    return acc;
  }, {} as Record<FooterPageKey, FooterPageSection>);
