import { getCookieConsent, hasAnalyticsConsent } from '../utils/cookieConsent';

type Primitive = string | number | boolean;
export type AnalyticsParams = Record<string, Primitive | EcommerceItem[] | undefined>;
export type EcommerceItem = { item_id: string; item_name: string; item_category?: string; price: number; quantity: number };
export type Attribution = { source?: string; medium?: string; campaign?: string; content?: string; term?: string; fbclid?: string; gclid?: string; ttclid?: string; msclkid?: string; landing_page: string; referring_domain?: string; captured_at: number };

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; } }

// Product names (item_name/box_name) are GA4 ecommerce fields, not identity data.
const PII_KEY = /^(email|mail|full_name|first_name|last_name|address|street|city|zip|postal_code|phone|username|password|customer|uid|user_id|external_id)$/i;
const EVENT_NAMES = new Set(['sign_up_start', 'sign_up', 'login', 'free_box_claim', 'view_item', 'box_open_start', 'box_open', 'item_won', 'sell_back', 'item_kept', 'begin_checkout', 'purchase', 'first_purchase', 'shipping_start', 'shipping_requested', 'checkout_return', 'page_view']);
const sentKeys = new Set<string>();
const measurementId = () => import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim();
const enabled = () => typeof window !== 'undefined' && Boolean(measurementId()) && hasAnalyticsConsent(getCookieConsent());
const debug = () => typeof window !== 'undefined' && (import.meta.env.VITE_APP_ENV !== 'production' || new URLSearchParams(window.location.search).get('ga_debug') === '1');

export const sanitizeAnalyticsParams = (params: AnalyticsParams = {}): Record<string, Exclude<AnalyticsParams[string], undefined>> => Object.fromEntries(Object.entries(params).filter(([key, value]) => value !== undefined && value !== null && !PII_KEY.test(key))) as Record<string, Exclude<AnalyticsParams[string], undefined>>;
export const coinsToUsd = (coins: number, coinsPerDollar = 100) => Math.round((Math.max(0, coins) / coinsPerDollar) * 100) / 100;

export const captureAttribution = (): Attribution | null => {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href); const q = url.searchParams;
  const source = q.get('utm_source') || undefined; const click = ['fbclid', 'gclid', 'ttclid', 'msclkid'].some((key) => q.has(key));
  if (!source && !click) return null;
  const touch: Attribution = { source, medium: q.get('utm_medium') || undefined, campaign: q.get('utm_campaign') || undefined, content: q.get('utm_content') || undefined, term: q.get('utm_term') || undefined, fbclid: q.get('fbclid') || undefined, gclid: q.get('gclid') || undefined, ttclid: q.get('ttclid') || undefined, msclkid: q.get('msclkid') || undefined, landing_page: url.pathname, referring_domain: document.referrer ? new URL(document.referrer).hostname : undefined, captured_at: Date.now() };
  if (!localStorage.getItem('pullz_first_touch')) localStorage.setItem('pullz_first_touch', JSON.stringify(touch));
  localStorage.setItem('pullz_last_touch', JSON.stringify(touch)); return touch;
};
export const getAttribution = (key: 'pullz_first_touch' | 'pullz_last_touch' = 'pullz_first_touch'): Attribution | null => { try { return typeof window === 'undefined' ? null : JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
export const getGaClientId = () => { const id = measurementId()?.replace(/^G-/, ''); const match = id && document.cookie.match(new RegExp(`(?:^|; )_ga_${id}=GS\\d+\\.\\d+\\.(\\d+)\\.(\\d+)`)); return match ? `${match[1]}.${match[2]}` : (document.cookie.match(/(?:^|; )_ga=GA\d+\.\d+\.(\d+\.\d+)/)?.[1] || ''); };

export const initializeAnalytics = () => {
  if (!enabled() || window.gtag) return false;
  const id = measurementId()!; window.dataLayer = window.dataLayer || [];
  window.gtag = (...args) => window.dataLayer!.push(args);
  window.gtag('js', new Date()); window.gtag('config', id, { send_page_view: false, debug_mode: debug() });
  const script = document.createElement('script'); script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`; script.dataset.pullzGa4 = 'true'; document.head.appendChild(script); captureAttribution(); return true;
};
export const trackEvent = (name: string, params: AnalyticsParams = {}, dedupeKey?: string) => {
  if (!EVENT_NAMES.has(name) || !enabled()) return false; initializeAnalytics();
  const key = dedupeKey ? `${name}:${dedupeKey}` : ''; if (key && sentKeys.has(key)) return false; if (key) sentKeys.add(key);
  const payload = sanitizeAnalyticsParams({ ...params, ...(debug() ? { debug_mode: true } : {}) }); window.gtag?.('event', name, payload); if (debug()) console.info('[GA4]', name, payload); return true;
};
export const trackPageView = (app_view: string) => typeof window !== 'undefined' && trackEvent('page_view', { page_title: document.title, page_location: `${location.origin}${location.pathname}`, page_path: location.pathname, app_view }, `${app_view}:${location.pathname}`);
export const setAnalyticsUser = (_opaqueId: string) => { /* Deliberately disabled: no consent-approved pseudonymous identifier exists. */ };
export const clearAnalyticsUser = () => { if (enabled()) window.gtag?.('config', measurementId(), { user_id: undefined }); };
export const trackSignUp = (p: { method: string; has_referral: boolean; signup_location: string }) => trackEvent('sign_up', p);
export const trackLogin = (method: string) => trackEvent('login', { method });
export const trackFreeBoxClaim = (p: AnalyticsParams, id: string) => trackEvent('free_box_claim', p, id);
export const trackViewBox = (p: AnalyticsParams, id: string) => trackEvent('view_item', p, id);
export const trackBoxOpenStart = (p: AnalyticsParams, id: string) => trackEvent('box_open_start', p, id);
export const trackBoxOpen = (p: AnalyticsParams, id: string) => trackEvent('box_open', p, id);
export const trackItemWon = (p: AnalyticsParams, id: string) => trackEvent('item_won', p, id);
export const trackSellBack = (p: AnalyticsParams, id: string) => trackEvent('sell_back', p, id);
export const trackItemKept = (p: AnalyticsParams, id: string) => trackEvent('item_kept', p, id);
export const trackBeginCheckout = (p: AnalyticsParams, id: string) => trackEvent('begin_checkout', p, id);
export const trackShippingStart = (p: AnalyticsParams, id: string) => trackEvent('shipping_start', p, id);
export const trackShippingRequested = (p: AnalyticsParams, id: string) => trackEvent('shipping_requested', p, id);
