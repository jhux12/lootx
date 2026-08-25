import { Timestamp } from 'firebase/firestore';

export type TwitterCard = 'summary' | 'summary_large_image';
export type RobotsMeta = 'index,follow' | 'index,nofollow' | 'noindex,follow' | 'noindex,nofollow';
export type SeoPageKey = 'home' | 'boxes' | 'faq' | 'about' | 'provablyFair';

export interface PageSeoSettings {
  label: string;
  path: string;
  title: string;
  description: string;
  index: boolean;
  shareImage: string;
}

export interface SeoSettings {
  siteName: string; seoTitle: string; metaDescription: string; canonicalUrl: string; keywords: string[];
  indexPage: boolean; followLinks: boolean; pages: Record<SeoPageKey, PageSeoSettings>;
  openGraphTitle: string; openGraphDescription: string; openGraphImage: string;
  twitterTitle: string; twitterDescription: string; twitterImage: string; twitterCard: TwitterCard;
  faviconUrl: string; appleTouchIcon: string; businessLogo: string;
  organizationName: string; organizationDescription: string; businessUrl: string; businessEmail: string; schemaLogo: string;
  socialProfiles: string[]; enableOrganizationSchema: boolean; enableWebsiteSchema: boolean; enableSearchActionSchema: boolean;
  googleVerification: string; bingVerification: string; pinterestVerification: string; yandexVerification: string;
  robotsMeta: RobotsMeta; sitemapUrl: string; additionalHeadMarkup: string;
  homepageShareImage: string; fallbackOpenGraphImage: string; fallbackTwitterImage: string;
  updatedAt?: Timestamp;
}

export const DEFAULT_PAGE_SEO: Record<SeoPageKey, PageSeoSettings> = {
  home: {
    label: 'Home', path: '/', title: 'Pullz.gg | Open Mystery Boxes & Win Real Collectibles',
    description: 'Open mystery boxes online and win real Pokémon cards, graded slabs, and collectibles. Keep your pull or sell it back instantly.', index: true, shareImage: ''
  },
  boxes: {
    label: 'Boxes', path: '/boxes', title: 'Mystery Boxes – Open & Win Real Collectibles | Pullz.gg',
    description: 'Browse Pullz.gg mystery boxes, review every possible pull and displayed odds, then open for a chance to win real collectibles.', index: true, shareImage: ''
  },
  faq: {
    label: 'FAQ', path: '/faq', title: 'FAQ – Frequently Asked Questions | Pullz.gg',
    description: 'Learn how Pullz.gg mystery boxes, shipping, sell-backs, coins, odds, and real collectible rewards work.', index: true, shareImage: ''
  },
  about: {
    label: 'About', path: '/about', title: 'About Pullz.gg – Mystery Boxes for Collectors',
    description: 'Meet Pullz.gg, an online mystery box experience built for collectors who want transparent odds and real items.', index: true, shareImage: ''
  },
  provablyFair: {
    label: 'Provably Fair', path: '/provably-fair', title: 'Provably Fair Mystery Box Results | Pullz.gg',
    description: 'See how Pullz.gg uses verifiable results and transparent odds to make every eligible mystery box opening auditable.', index: true, shareImage: ''
  }
};

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  siteName: 'Pullz.gg', seoTitle: DEFAULT_PAGE_SEO.home.title,
  metaDescription: DEFAULT_PAGE_SEO.home.description,
  canonicalUrl: 'https://www.pullz.gg', keywords: ['mystery boxes', 'Pokémon cards', 'graded slabs', 'online case opening'],
  indexPage: true, followLinks: true, pages: DEFAULT_PAGE_SEO,
  openGraphTitle: 'Open Pokémon Mystery Boxes on Pullz.gg', openGraphDescription: 'Open digital mystery boxes and reveal authentic trading cards and collectibles delivered to your door.', openGraphImage: '',
  twitterTitle: '', twitterDescription: '', twitterImage: '', twitterCard: 'summary_large_image',
  faviconUrl: '', appleTouchIcon: '', businessLogo: '', organizationName: 'Pullz.gg', organizationDescription: '', businessUrl: 'https://www.pullz.gg', businessEmail: '', schemaLogo: '', socialProfiles: [],
  enableOrganizationSchema: true, enableWebsiteSchema: true, enableSearchActionSchema: false,
  googleVerification: '', bingVerification: '', pinterestVerification: '', yandexVerification: '', robotsMeta: 'index,follow', sitemapUrl: 'https://www.pullz.gg/sitemap.xml', additionalHeadMarkup: '', homepageShareImage: '', fallbackOpenGraphImage: '', fallbackTwitterImage: ''
};

export const normalizeSeoSettings = (value?: Partial<SeoSettings>): SeoSettings => ({
  ...DEFAULT_SEO_SETTINGS,
  ...value,
  keywords: Array.isArray(value?.keywords) ? value.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : DEFAULT_SEO_SETTINGS.keywords,
  socialProfiles: Array.isArray(value?.socialProfiles) ? value.socialProfiles : [],
  pages: Object.fromEntries(
    (Object.keys(DEFAULT_PAGE_SEO) as SeoPageKey[]).map((key) => [key, { ...DEFAULT_PAGE_SEO[key], ...(value?.pages?.[key] ?? {}) }])
  ) as Record<SeoPageKey, PageSeoSettings>
});

export const isSafeUrl = (value: string, required = false) => {
  if (!value.trim()) return !required;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
};
export const hasUnsafeMarkup = (value: string) => /<\s*\/?\s*script\b|javascript\s*:/i.test(value);

export const validateSeoSettings = (settings: SeoSettings) => {
  const errors: string[] = [];
  const urls: Array<[string, string, boolean?]> = [['Canonical URL', settings.canonicalUrl, true], ['Open Graph image', settings.openGraphImage], ['Twitter image', settings.twitterImage], ['Favicon', settings.faviconUrl], ['Apple touch icon', settings.appleTouchIcon], ['Business logo', settings.businessLogo], ['Website URL', settings.businessUrl], ['Schema logo', settings.schemaLogo], ['Sitemap URL', settings.sitemapUrl], ['Homepage share image', settings.homepageShareImage], ['Fallback Open Graph image', settings.fallbackOpenGraphImage], ['Fallback Twitter image', settings.fallbackTwitterImage]];
  urls.forEach(([label, value, required]) => { if (!isSafeUrl(value, required)) errors.push(`${label} must be a valid http(s) URL.`); });
  settings.socialProfiles.forEach((url) => { if (!isSafeUrl(url)) errors.push('Every social profile must be a valid http(s) URL.'); });
  if (settings.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.businessEmail)) errors.push('Business email is invalid.');
  if (settings.seoTitle.length < 50 || settings.seoTitle.length > 60) errors.push('SEO title should be 50–60 characters.');
  if (settings.metaDescription.length < 140 || settings.metaDescription.length > 160) errors.push('Meta description should be 140–160 characters.');
  (Object.keys(settings.pages) as SeoPageKey[]).forEach((key) => {
    const page = settings.pages[key];
    if (!page.title.trim()) errors.push(`${page.label} needs a title.`);
    if (!page.description.trim()) errors.push(`${page.label} needs a description.`);
    if (page.shareImage && !isSafeUrl(page.shareImage)) errors.push(`${page.label} share image must be a valid http(s) URL.`);
  });
  Object.entries(settings).forEach(([key, value]) => { if (typeof value === 'string' && key !== 'additionalHeadMarkup' && hasUnsafeMarkup(value)) errors.push(`${key} contains unsafe markup.`); });
  if (/<\s*script\b/i.test(settings.additionalHeadMarkup)) errors.push('Additional head code cannot contain script tags.');
  return errors;
};
