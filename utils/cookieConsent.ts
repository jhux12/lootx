export type CookieConsentValue = 'essential' | 'all';

const STORAGE_KEY = 'cookieConsent';

export const getCookieConsent = (): CookieConsentValue | null => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === 'essential' || value === 'all') {
    return value;
  }
  return null;
};

export const setCookieConsent = (value: CookieConsentValue) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent('pullz:cookie-consent', { detail: value }));
};

export const hasAnalyticsConsent = (value?: CookieConsentValue | null) => value === 'all';

export const hasMarketingConsent = (value?: CookieConsentValue | null) => value === 'all';

export const loadMarketingScripts = () => {
  if (typeof window === 'undefined' || !hasMarketingConsent(getCookieConsent())) return false;
  const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();
  if (!pixelId) return false;

  type MetaPixelQueue = ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[][];
    loaded: boolean;
    version: string;
    push: MetaPixelQueue;
  };
  const pixelWindow = window as Window & typeof globalThis & {
    fbq?: MetaPixelQueue;
    _fbq?: MetaPixelQueue;
  };

  if (pixelWindow.fbq) return false;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue.push(args);
    }
  } as MetaPixelQueue;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  pixelWindow.fbq = fbq;
  pixelWindow._fbq = fbq;

  fbq('init', pixelId);
  fbq('consent', 'grant');
  fbq('track', 'PageView');

  if (!document.querySelector('script[data-pullz-meta-pixel]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.dataset.pullzMetaPixel = 'true';
    document.head.appendChild(script);
  }
  return true;
};
