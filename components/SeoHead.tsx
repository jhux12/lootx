import { useEffect, useState } from 'react';
import { getCachedDocument } from '../utils/firestoreCache';
import { DEFAULT_SEO_SETTINGS, SeoSettings, normalizeSeoSettings } from '../utils/seoSettings';
import { ViewState } from '../types';

const STATIC_IMAGE = 'https://pullz.gg/assets/png/pullz-horizontal-dark-2400.png';
// Search currently opens in-app rather than on a crawlable public route.
const HAS_PUBLIC_SEARCH_PAGE = false;
const meta = (selector: string, attrs: Record<string, string>, enabled = true) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!enabled) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
};
const link = (rel: string, href: string, enabled = true) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!enabled) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
};
const jsonLd = (id: string, value?: object) => { let el = document.getElementById(id) as HTMLScriptElement | null; if (!value) { el?.remove(); return; } if (!el) { el = document.createElement('script'); el.id = id; el.type = 'application/ld+json'; document.head.appendChild(el); } el.textContent = JSON.stringify(value); };
// Additional markup is intentionally limited to harmless metadata and links; executable code is never injected.
const applyAdditionalHeadMarkup = (markup: string) => {
  document.head.querySelectorAll('[data-pullz-seo-additional]').forEach((node) => node.remove());
  if (!markup.trim()) return;
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  Array.from(parsed.head.children).forEach((candidate) => {
    if (!(candidate instanceof HTMLMetaElement || candidate instanceof HTMLLinkElement)) return;
    const identity = candidate instanceof HTMLMetaElement
      ? candidate.getAttribute('name') ? `meta[name="${candidate.getAttribute('name')}"]` : candidate.getAttribute('property') ? `meta[property="${candidate.getAttribute('property')}"]` : ''
      : candidate.getAttribute('rel') ? `link[rel="${candidate.getAttribute('rel')}"]` : '';
    if (!identity || document.head.querySelector(identity)) return;
    const copy = candidate.cloneNode(true) as HTMLElement; copy.dataset.pullzSeoAdditional = 'true'; document.head.appendChild(copy);
  });
};
const privateView = (view: ViewState) => ['PROFILE', 'INVENTORY', 'BONUSES', 'QUESTS', 'POLLS', 'REFERRALS', 'PLINKO', 'CUSTOM_CREATOR', 'CASE_OPENING', 'BATTLES', 'BATTLE_ARENA', 'SPIN', 'VERIFY_EMAIL', 'ADMIN', 'ADMIN_UPGRADER_SETTINGS', 'ADMIN_UPGRADER_TARGETS'].includes(view.type);

export const SeoHead = ({ view }: { view: ViewState }) => {
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  useEffect(() => { let active = true; void getCachedDocument('site/seo', 30 * 60_000).then((data) => { if (active) setSettings(normalizeSeoSettings(data as Partial<SeoSettings>)); }).catch(() => { if (active) setSettings(DEFAULT_SEO_SETTINGS); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const isPrivate = privateView(view); const base = settings.canonicalUrl || DEFAULT_SEO_SETTINGS.canonicalUrl;
    const canonical = isPrivate ? `${base.replace(/\/$/, '')}${window.location.pathname}` : base;
    const robots = isPrivate ? 'noindex,nofollow' : `${settings.indexPage ? 'index' : 'noindex'},${settings.followLinks ? 'follow' : 'nofollow'}`;
    const ogTitle = settings.openGraphTitle || settings.seoTitle; const ogDescription = settings.openGraphDescription || settings.metaDescription;
    const ogImage = settings.openGraphImage || settings.fallbackOpenGraphImage || settings.homepageShareImage || STATIC_IMAGE;
    const twitterImage = settings.twitterImage || settings.fallbackTwitterImage || ogImage;
    document.title = isPrivate ? settings.siteName : settings.seoTitle;
    link('canonical', canonical); link('icon', settings.faviconUrl, !!settings.faviconUrl); link('apple-touch-icon', settings.appleTouchIcon, !!settings.appleTouchIcon);
    meta('meta[name="description"]', { name: 'description', content: isPrivate ? 'Private Pullz.gg area.' : settings.metaDescription }); meta('meta[name="robots"]', { name: 'robots', content: robots });
    meta('meta[property="og:type"]', { property: 'og:type', content: 'website' }); meta('meta[property="og:site_name"]', { property: 'og:site_name', content: settings.siteName }); meta('meta[property="og:title"]', { property: 'og:title', content: ogTitle }); meta('meta[property="og:description"]', { property: 'og:description', content: ogDescription }); meta('meta[property="og:image"]', { property: 'og:image', content: ogImage }); meta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    meta('meta[name="twitter:card"]', { name: 'twitter:card', content: settings.twitterCard }); meta('meta[name="twitter:title"]', { name: 'twitter:title', content: settings.twitterTitle || ogTitle }); meta('meta[name="twitter:description"]', { name: 'twitter:description', content: settings.twitterDescription || ogDescription }); meta('meta[name="twitter:image"]', { name: 'twitter:image', content: twitterImage });
    meta('meta[name="google-site-verification"]', { name: 'google-site-verification', content: settings.googleVerification }, !!settings.googleVerification); meta('meta[name="msvalidate.01"]', { name: 'msvalidate.01', content: settings.bingVerification }, !!settings.bingVerification); meta('meta[name="p:domain_verify"]', { name: 'p:domain_verify', content: settings.pinterestVerification }, !!settings.pinterestVerification); meta('meta[name="yandex-verification"]', { name: 'yandex-verification', content: settings.yandexVerification }, !!settings.yandexVerification);
    const url = settings.businessUrl || base; const org = settings.enableOrganizationSchema ? { '@context': 'https://schema.org', '@type': 'Organization', name: settings.organizationName || settings.siteName, url, description: settings.organizationDescription || undefined, email: settings.businessEmail || undefined, logo: settings.schemaLogo || settings.businessLogo || undefined, sameAs: settings.socialProfiles.filter(Boolean) } : undefined;
    const website = settings.enableWebsiteSchema ? { '@context': 'https://schema.org', '@type': 'WebSite', name: settings.siteName, url, ...(settings.enableSearchActionSchema && HAS_PUBLIC_SEARCH_PAGE ? { potentialAction: { '@type': 'SearchAction', target: `${url.replace(/\/$/, '')}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } } : {}) } : undefined;
    jsonLd('pullz-seo-organization', org); jsonLd('pullz-seo-website', website);
    applyAdditionalHeadMarkup(settings.additionalHeadMarkup);
  }, [settings, view]);
  return null;
};
