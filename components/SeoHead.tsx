import { useEffect } from 'react';
import { ViewState } from '../types';

type SeoConfig = {
  title: string;
  description: string;
  path: string;
  robots: 'index, follow' | 'noindex, nofollow';
};

const SITE_URL = 'https://pullz.gg';
const FALLBACK_IMAGE = `${SITE_URL}/preview.png`;

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
        title: 'Pullz.gg Mystery Boxes',
        description: 'Open premium mystery boxes with provably fair outcomes, live drops, and instant rewards.',
        path: '/',
        robots: 'index, follow'
      };
    case 'BOXES':
      return {
        title: 'Mystery Boxes | Pullz.gg',
        description: 'Browse Pullz.gg mystery boxes by budget, rarity, and drop style before you open.',
        path: '/boxes',
        robots: 'index, follow'
      };
    case 'CONTACT':
      return {
        title: 'Contact Support | Pullz.gg',
        description: 'Need help with your account, rewards, or orders? Contact the Pullz.gg support team.',
        path: '/contact',
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
        title: 'Provably Fair Overview | Pullz.gg',
        description: 'Understand how Pullz.gg provably fair seeds, nonces, and verification proofs work.',
        path: '/provably-fair',
        robots: 'index, follow'
      };
    case 'PROFILE':
    case 'INVENTORY':
    case 'BONUSES':
    case 'QUESTS':
    case 'ADMIN':
    case 'ADMIN_UPGRADER_SETTINGS':
    case 'ADMIN_UPGRADER_TARGETS':
      return {
        title: 'Account | Pullz.gg',
        description: 'Private Pullz.gg account area.',
        path: window.location.pathname || '/',
        robots: 'noindex, nofollow'
      };
    default:
      return {
        title: 'Pullz.gg Mystery Boxes',
        description: 'Open premium mystery boxes with provably fair outcomes, live drops, and instant rewards.',
        path: window.location.pathname || '/',
        robots: 'noindex, nofollow'
      };
  }
};

export const SeoHead = ({ view }: { view: ViewState }) => {
  useEffect(() => {
    const seo = getSeoConfigForView(view);
    const canonicalUrl = `${SITE_URL}${seo.path}`;

    document.title = seo.title;
    ensureCanonical().setAttribute('href', canonicalUrl);

    ensureMeta('meta[name="description"]', { name: 'description', content: seo.description });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: seo.robots });

    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Pullz.gg' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: FALLBACK_IMAGE });
    ensureMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/png' });
    ensureMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' });
    ensureMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' });

    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: FALLBACK_IMAGE });
    ensureMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: 'Pullz.gg homepage social preview' });
  }, [view]);

  return null;
};
