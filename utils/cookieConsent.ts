export type CookieConsentValue = 'necessary' | 'essential' | 'all';
export type ConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
};

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = 'pullzCookiePreferences';
const LEGACY_STORAGE_KEY = 'cookieConsent';
const CONSENT_EVENT = 'pullz:cookie-consent';

const safeGet = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const safeSet = (key: string, value: string) => { try { window.localStorage.setItem(key, value); return true; } catch { return false; } };

const isPreferences = (value: unknown): value is ConsentPreferences => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ConsentPreferences>;
  return record.version === CONSENT_VERSION && record.necessary === true &&
    typeof record.analytics === 'boolean' && typeof record.advertising === 'boolean' &&
    typeof record.updatedAt === 'string' && !Number.isNaN(Date.parse(record.updatedAt));
};

export const getConsentPreferences = (): ConsentPreferences | null => {
  if (typeof window === 'undefined') return null;
  const stored = safeGet(CONSENT_STORAGE_KEY);
  if (stored) {
    try { const parsed: unknown = JSON.parse(stored); if (isPreferences(parsed)) return parsed; } catch { /* invalid records are replaced after a decision */ }
  }
  const legacy = safeGet(LEGACY_STORAGE_KEY);
  if (legacy !== 'all' && legacy !== 'necessary' && legacy !== 'essential') return null;
  const granted = legacy === 'all';
  const migrated: ConsentPreferences = { version: CONSENT_VERSION, necessary: true, analytics: granted, advertising: granted, updatedAt: new Date().toISOString() };
  safeSet(CONSENT_STORAGE_KEY, JSON.stringify(migrated));
  if (legacy === 'essential') safeSet(LEGACY_STORAGE_KEY, 'necessary');
  return migrated;
};

export const getCookieConsent = (): CookieConsentValue | null => {
  const preferences = getConsentPreferences();
  if (!preferences) return null;
  return preferences.advertising ? 'all' : 'necessary';
};

export const hasAnalyticsConsent = (_value?: CookieConsentValue | null) => getConsentPreferences()?.analytics === true;
export const hasMarketingConsent = (_value?: CookieConsentValue | null) => getConsentPreferences()?.advertising === true;

type MetaPixelQueue = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: MetaPixelQueue };
type TrackingWindow = Window & typeof globalThis & { fbq?: MetaPixelQueue; _fbq?: MetaPixelQueue; __pullzMetaInitialized?: boolean; __pullzMetaPageViewSent?: boolean };

export const loadMarketingScripts = () => {
  if (typeof window === 'undefined' || !hasMarketingConsent()) return false;
  const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();
  if (!pixelId) return false;
  const pixelWindow = window as TrackingWindow;
  let fbq = pixelWindow.fbq;
  if (!fbq) {
    fbq = function (...args: unknown[]) { if (fbq!.callMethod) fbq!.callMethod(...args); else fbq!.queue.push(args); } as MetaPixelQueue;
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    pixelWindow.fbq = fbq; pixelWindow._fbq = fbq;
  }
  fbq('consent', 'grant');
  if (!pixelWindow.__pullzMetaInitialized) { fbq('init', pixelId); pixelWindow.__pullzMetaInitialized = true; }
  if (!pixelWindow.__pullzMetaPageViewSent) { fbq('track', 'PageView'); pixelWindow.__pullzMetaPageViewSent = true; }
  if (!document.querySelector('script[data-pullz-meta-pixel]')) {
    const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; script.dataset.pullzMetaPixel = 'true';
    script.onerror = () => { /* blockers are expected and must not affect the app */ }; document.head.appendChild(script);
  }
  return true;
};

export const withdrawMarketingConsent = () => {
  if (typeof window === 'undefined') return;
  const fbq = (window as TrackingWindow).fbq;
  if (typeof fbq === 'function') fbq('consent', 'revoke');
};

export const setConsentPreferences = (choices: { analytics: boolean; advertising: boolean }) => {
  if (typeof window === 'undefined') return null;
  const previousAdvertising = getConsentPreferences()?.advertising === true;
  const preferences: ConsentPreferences = { version: CONSENT_VERSION, necessary: true, ...choices, updatedAt: new Date().toISOString() };
  safeSet(CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  // Existing integrations use this legacy value. Advertising approval must remain `all`.
  safeSet(LEGACY_STORAGE_KEY, choices.advertising ? 'all' : 'necessary');
  if (choices.advertising) loadMarketingScripts(); else if (previousAdvertising) withdrawMarketingConsent();
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: preferences }));
  return preferences;
};

export const setCookieConsent = (value: CookieConsentValue) => setConsentPreferences({ analytics: value === 'all', advertising: value === 'all' });
