import { Timestamp } from 'firebase/firestore';
import { PUBLIC_BRAND } from '../config/publicBrand';

export type TwitterCard = 'summary' | 'summary_large_image';
export type RobotsMeta = 'index,follow' | 'index,nofollow' | 'noindex,follow' | 'noindex,nofollow';

export interface SeoSettings {
  siteName: string; seoTitle: string; metaDescription: string; canonicalUrl: string;
  indexPage: boolean; followLinks: boolean;
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

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  siteName: PUBLIC_BRAND.name, seoTitle: `${PUBLIC_BRAND.name} | Pokémon Mystery Boxes & Trading Cards`,
  metaDescription: 'Open Pokémon mystery packs online and collect authentic trading cards, sealed products, and collectibles. Keep your pulls, ship them, or sell them back for coins.',
  canonicalUrl: PUBLIC_BRAND.canonicalOrigin, indexPage: true, followLinks: true,
  openGraphTitle: 'Open Pokémon Mystery Packs on Ripza', openGraphDescription: 'Open digital mystery packs and reveal authentic trading cards and collectibles delivered to your door.', openGraphImage: '',
  twitterTitle: '', twitterDescription: '', twitterImage: '', twitterCard: 'summary_large_image',
  faviconUrl: '', appleTouchIcon: '', businessLogo: '', organizationName: PUBLIC_BRAND.name, organizationDescription: '', businessUrl: PUBLIC_BRAND.canonicalOrigin, businessEmail: PUBLIC_BRAND.contactEmail, schemaLogo: '', socialProfiles: [],
  enableOrganizationSchema: true, enableWebsiteSchema: true, enableSearchActionSchema: false,
  googleVerification: '', bingVerification: '', pinterestVerification: '', yandexVerification: '', robotsMeta: 'index,follow', sitemapUrl: `${PUBLIC_BRAND.canonicalOrigin}/sitemap.xml`, additionalHeadMarkup: '', homepageShareImage: '', fallbackOpenGraphImage: '', fallbackTwitterImage: ''
};

export const normalizeSeoSettings = (value?: Partial<SeoSettings>): SeoSettings => ({ ...DEFAULT_SEO_SETTINGS, ...value, socialProfiles: Array.isArray(value?.socialProfiles) ? value.socialProfiles : [] });

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
  Object.entries(settings).forEach(([key, value]) => { if (typeof value === 'string' && key !== 'additionalHeadMarkup' && hasUnsafeMarkup(value)) errors.push(`${key} contains unsafe markup.`); });
  if (/<\s*script\b/i.test(settings.additionalHeadMarkup)) errors.push('Additional head code cannot contain script tags.');
  return errors;
};
