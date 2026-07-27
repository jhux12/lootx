import { getCookieConsent, hasAnalyticsConsent } from '../utils/cookieConsent';
export { coinsToUsd } from '../utils/economy';

type Primitive = string | number | boolean;
export type EcommerceItem = { item_id: string; item_name: string; item_category?: string; price: number; quantity: number };
export type AnalyticsParams = Record<string, Primitive | EcommerceItem[] | undefined>;
export type Attribution = { source?: string; medium?: string; campaign?: string; content?: string; term?: string; fbclid?: string; gclid?: string; ttclid?: string; msclkid?: string; facebook_campaign?: string; facebook_adset?: string; facebook_ad?: string; creative_id?: string; placement?: string; device_type: 'mobile' | 'tablet' | 'desktop'; landing_page: string; referring_domain?: string; browser_language?: string; country?: string; captured_at: number };
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; } }

export const GA4_EVENT_NAMES = ['sign_up_start', 'sign_up', 'login', 'free_box_claim', 'free_box_to_checkout', 'view_item', 'box_open_start', 'box_open', 'item_won', 'sell_back', 'item_kept', 'coin_package_view', 'coin_package_select', 'begin_checkout', 'checkout_return', 'checkout_abandoned', 'checkout_failed', 'purchase', 'deposit_completed', 'repeat_deposit', 'second_purchase', 'third_purchase', 'first_purchase', 'shipping_start', 'shipping_requested', 'page_view'] as const;
export type Ga4EventName = typeof GA4_EVENT_NAMES[number];
const EVENTS = new Set<string>(GA4_EVENT_NAMES);
const PII_KEY = /^(email|mail|full_name|first_name|last_name|address|street|city|zip|postal_code|phone|username|password|customer|uid|user_id|external_id|stripe_customer_id)$/i;
const SESSION_DEDUP_PREFIX = 'pullz_ga4_sent:';
const PAGE_VIEW_DEDUP_MS = 1_000;
let lastPageView: { key: string; sentAt: number } | null = null;
const measurementId = () => import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim();
const enabled = () => typeof window !== 'undefined' && Boolean(measurementId()) && hasAnalyticsConsent(getCookieConsent());
const debugEnabled = () => typeof window !== 'undefined' && (import.meta.env.VITE_APP_ENV !== 'production' || new URLSearchParams(location.search).get('ga_debug') === '1');
const debug = (name: string, details: Record<string, unknown>) => { if (debugEnabled()) console.info('[GA4]', { event: name, timestamp: new Date().toISOString(), ...details }); };
export const updateAnalyticsConsent = (granted: boolean) => {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(..._args: unknown[]) { window.dataLayer!.push(arguments); };
  window.gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
};
export const sanitizeAnalyticsParams = (params: AnalyticsParams = {}) => Object.fromEntries(Object.entries(params).filter(([key, value]) => value !== undefined && value !== null && !PII_KEY.test(key)));
const wasSentThisSession = (key: string) => { try { return sessionStorage.getItem(`${SESSION_DEDUP_PREFIX}${key}`) === '1'; } catch { return false; } };
const markSentThisSession = (key: string) => { try { sessionStorage.setItem(`${SESSION_DEDUP_PREFIX}${key}`, '1'); } catch { /* private browsing may deny storage */ } };

const firstParam = (q: URLSearchParams, ...keys: string[]) => keys.map((key) => q.get(key)).find((value): value is string => Boolean(value));
const deviceType = (): Attribution['device_type'] => /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
export const captureAttribution = (): Attribution | null => {
  if (typeof window === 'undefined') return null;
  const url = new URL(location.href); const q = url.searchParams;
  const source = q.get('utm_source') || undefined;
  const tagged = Boolean(source || ['fbclid', 'gclid', 'ttclid', 'msclkid'].some((key) => q.has(key)) || firstParam(q, 'campaign_id', 'adset_id', 'ad_id', 'creative_id'));
  if (!tagged) return null;
  const touch: Attribution = { source, medium: q.get('utm_medium') || undefined, campaign: q.get('utm_campaign') || firstParam(q, 'campaign_name'), content: q.get('utm_content') || undefined, term: q.get('utm_term') || undefined, fbclid: q.get('fbclid') || undefined, gclid: q.get('gclid') || undefined, ttclid: q.get('ttclid') || undefined, msclkid: q.get('msclkid') || undefined, facebook_campaign: firstParam(q, 'campaign_id', 'fb_campaign'), facebook_adset: firstParam(q, 'adset_id', 'fb_adset'), facebook_ad: firstParam(q, 'ad_id', 'fb_ad'), creative_id: firstParam(q, 'creative_id', 'creative'), placement: firstParam(q, 'placement', 'fb_placement'), device_type: deviceType(), landing_page: url.pathname, referring_domain: document.referrer ? new URL(document.referrer).hostname : undefined, browser_language: navigator.language || undefined, captured_at: Date.now() };
  if (!localStorage.getItem('pullz_first_touch')) localStorage.setItem('pullz_first_touch', JSON.stringify(touch));
  localStorage.setItem('pullz_last_touch', JSON.stringify(touch)); return touch;
};
export const getAttribution = (key: 'pullz_first_touch' | 'pullz_last_touch' = 'pullz_first_touch'): Attribution | null => { try { return typeof window === 'undefined' ? null : JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
export const getGaClientId = () => {
  if (typeof document === 'undefined') return '';
  // Measurement Protocol client_id comes from the base _ga cookie. The
  // _ga_<measurement> cookie contains GA4 session state, not the client ID.
  return document.cookie.match(/(?:^|; )_ga=GA\d+\.\d+\.(\d+\.\d+)/)?.[1] || '';
};
export const initializeAnalytics = () => {
  if (!enabled()) { debug('initialize', { skipped: true, reason: 'missing_measurement_id_or_consent' }); return false; }
  if (window.gtag || document.querySelector('script[data-pullz-ga4]')) { debug('initialize', { skipped: true, reason: 'already_initialized' }); return false; }
  const id = measurementId()!;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(..._args: unknown[]) {
    window.dataLayer!.push(arguments);
  };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false, debug_mode: debugEnabled() });
  const script = document.createElement('script'); script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`; script.dataset.pullzGa4 = 'true'; document.head.appendChild(script); captureAttribution(); debug('initialize', { skipped: false }); return true;
};
export const trackEvent = (name: Ga4EventName, params: AnalyticsParams = {}, dedupeKey?: string) => {
  const payload = sanitizeAnalyticsParams(params); const key = dedupeKey ? `${name}:${dedupeKey}` : undefined;
  if (!EVENTS.has(name)) { debug(name, { skipped: true, reason: 'invalid_event_name', dedupe_key: key, payload }); return false; }
  if (!enabled()) { debug(name, { skipped: true, reason: 'missing_measurement_id_or_consent', dedupe_key: key, payload }); return false; }
  if (key && wasSentThisSession(key)) { debug(name, { skipped: true, reason: 'session_deduplicated', dedupe_key: key, payload }); return false; }
  initializeAnalytics(); if (key) markSentThisSession(key);
  const finalPayload = { ...payload, ...(debugEnabled() ? { debug_mode: true } : {}) }; window.gtag?.('event', name, finalPayload); debug(name, { skipped: false, dedupe_key: key, payload: finalPayload }); return true;
};
export const trackPageView = (app_view: string) => {
  if (typeof window === 'undefined') return false;
  const key = `${app_view}:${location.pathname}:${location.search}`;
  const now = Date.now();
  if (lastPageView?.key === key && now - lastPageView.sentAt < PAGE_VIEW_DEDUP_MS) {
    debug('page_view', { skipped: true, reason: 'transient_deduplicated', dedupe_key: key });
    return false;
  }
  const sent = trackEvent('page_view', {
    page_title: document.title,
    page_location: `${location.origin}${location.pathname}`,
    page_path: location.pathname,
    app_view
  });
  if (sent) lastPageView = { key, sentAt: now };
  return sent;
};
export const setAnalyticsUser = (_opaqueId: string) => undefined;
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
export const trackCoinPackageView = (p: AnalyticsParams, id: string) => trackEvent('coin_package_view', p, id);
export const trackCoinPackageSelect = (p: AnalyticsParams, id: string) => trackEvent('coin_package_select', p, id);
export const trackBeginCheckout = (p: AnalyticsParams, id: string) => trackEvent('begin_checkout', p, id);
export const trackShippingStart = (p: AnalyticsParams, id: string) => trackEvent('shipping_start', p, id);
export const trackShippingRequested = (p: AnalyticsParams, id: string) => trackEvent('shipping_requested', p, id);
