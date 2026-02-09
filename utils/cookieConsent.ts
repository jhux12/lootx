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
};

export const hasAnalyticsConsent = (value?: CookieConsentValue | null) => value === 'all';

export const hasMarketingConsent = (_value?: CookieConsentValue | null) => false;

export const loadMarketingScripts = () => {
  // Ads will be enabled later
};
