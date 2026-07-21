import { useEffect } from 'react';
import { ViewState } from '../types';

type SeoConfig = {
  title: string;
  description: string;
  path: string;
  robots: 'index, follow' | 'noindex, nofollow';
};

const SITE_URL = 'https://pullz.gg';
const SOCIAL_TITLE = 'Pullz.gg | Open Digital Boxes. Win Real Cards.';
const META_DESCRIPTION = 'Open digital boxes and win real Pokémon cards. Every win is a real item that can be shipped directly to your door. Provably fair and secure.';
const SOCIAL_DESCRIPTION = 'Ship real items to your door. Provably fair. Claim your first box free.';
const SOCIAL_IMAGE = `${SITE_URL}/assets/png/pullz-horizontal-dark-2400.png`;
const CANONICAL_URL = SITE_URL;
const HOMEPAGE_DESCRIPTION = META_DESCRIPTION;

const ensureMeta = (selector: string, attributes: Record<string, string>) => {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement('meta');
    document.head.appendChild(node);
  }
  Object.entries(attributes).forEach(([key, value]) => node!.setAttribute(key, value));
  return node;
};

const ensureCanonical = () => {
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  return node;
};

const getSeoConfigForView = (view: ViewState): SeoConfig => {
  switch (view.type) {
    case 'HOME':
      return {
        title: SOCIAL_TITLE,
        description: HOMEPAGE_DESCRIPTION,
        path: '/',
        robots: 'index, follow'
      };
    case 'BOXES':
      return {
        title: 'Boxes | Pokémon Mystery Boxes | Pullz.gg',
        description: 'Browse Pokémon mystery boxes on Pullz.gg by budget, rarity, and collectible drop style.',
        path: '/boxes',
        robots: 'index, follow'
      };
    case 'LEADERBOARD':
      return {
        title: 'Leaderboards | Pullz.gg',
        description: 'See Pullz.gg leaderboard standings, top players, and current rewards competition details.',
        path: '/leaderboards',
        robots: 'index, follow'
      };
    case 'CONTACT':
      return {
        title: 'Contact Us | Pullz.gg',
        description: 'Need help with your Pullz.gg account, mystery box rewards, shipments, or orders? Contact support.',
        path: '/contact',
        robots: 'index, follow'
      };
    case 'FAQ':
      return {
        title: 'FAQ | Pullz.gg',
        description: 'Find answers about Pullz.gg Pokémon mystery boxes, rewards, sell-back options, shipping, and fairness.',
        path: '/faq',
        robots: 'index, follow'
      };
    case 'ABOUT':
      return {
        title: 'About Pullz.gg | Pokémon Mystery Boxes',
        description: 'Learn about Pullz.gg, an online Pokémon mystery box platform for winning real collectibles.',
        path: '/about',
        robots: 'index, follow'
      };
    case 'SHIPPING_POLICY':
      return {
        title: 'Shipping Policy | Pullz.gg',
        description: 'Learn how Pullz.gg handles shipment requests for eligible physical collectibles won on the site.',
        path: '/shipping-policy',
        robots: 'index, follow'
      };
    case 'REFUND_POLICY':
      return {
        title: 'Refund Policy | Pullz.gg',
        description: 'Review Pullz.gg refund expectations for site credit purchases, mystery box openings, and support reviews.',
        path: '/refund-policy',
        robots: 'index, follow'
      };
    case 'TERMS':
      return {
        title: 'Terms of Service | Pullz.gg',
        description: 'Review the Pullz.gg Terms of Service, eligibility rules, and platform usage policies.',
        path: '/terms',
        robots: 'index, follow'
      };
    case 'PRIVACY':
      return {
        title: 'Privacy Policy | Pullz.gg',
        description: 'Learn how Pullz.gg handles, protects, and processes your account and gameplay data.',
        path: '/privacy',
        robots: 'index, follow'
      };
    case 'PROVABLY_FAIR':
      return {
        title: 'Provably Fair | Pullz.gg',
        description: 'Understand how Pullz.gg provably fair seeds, nonces, and verification proofs work.',
        path: '/provably-fair',
        robots: 'index, follow'
      };
    case 'PROFILE':
    case 'INVENTORY':
    case 'BONUSES':
    case 'QUESTS':
    case 'POLLS':
    case 'REFERRALS':
    case 'PLINKO':
    case 'CUSTOM_CREATOR':
    case 'CASE_OPENING':
    case 'BATTLES':
    case 'BATTLE_ARENA':
    case 'SPIN':
    case 'VERIFY_EMAIL':
    case 'ADMIN':
    case 'ADMIN_UPGRADER_SETTINGS':
    case 'ADMIN_UPGRADER_TARGETS':
      return {
        title: 'Pullz.gg',
        description: 'Private or app-only Pullz.gg area.',
        path: window.location.pathname || '/',
        robots: 'noindex, nofollow'
      };
    default:
      return {
        title: SOCIAL_TITLE,
        description: HOMEPAGE_DESCRIPTION,
        path: window.location.pathname || '/',
        robots: 'noindex, nofollow'
      };
  }
};

export const SeoHead = ({ view }: { view: ViewState }) => {
  useEffect(() => {
    const seo = getSeoConfigForView(view);
    document.title = seo.title;
    ensureCanonical().setAttribute('href', CANONICAL_URL);

    ensureMeta('meta[name="description"]', { name: 'description', content: seo.description });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: seo.robots });

    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Pullz.gg' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: SOCIAL_TITLE });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: SOCIAL_DESCRIPTION });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: SOCIAL_IMAGE });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: CANONICAL_URL });
    ensureMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/png' });
    ensureMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '2400' });
    ensureMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '619' });

    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: SOCIAL_TITLE });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: SOCIAL_DESCRIPTION });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: SOCIAL_IMAGE });
    ensureMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: 'Pullz logo' });
  }, [view]);

  return null;
};
