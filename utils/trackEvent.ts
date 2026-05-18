type TrackEventData = Record<string, unknown>;
type TrackEventOptions = {
  eventID?: string;
};

type FacebookPixelAction = 'track' | 'trackCustom';
type FacebookPixelFn = (
  action: FacebookPixelAction,
  eventName: string,
  data?: TrackEventData,
  options?: TrackEventOptions
) => void;

const recentEventKeys = new Map<string, number>();
const DUPLICATE_EVENT_WINDOW_MS = 250;

const STANDARD_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Purchase',
  'AddToCart',
  'InitiateCheckout',
  'Lead',
  'CompleteRegistration',
  'Search'
]);

declare global {
  interface Window {
    fbq?: FacebookPixelFn;
  }
}

export const trackEvent = (eventName: string, data?: TrackEventData) => {
  trackMetaEvent(eventName, data);
};

export const trackMetaEvent = (
  eventName: string,
  data?: TrackEventData,
  options?: TrackEventOptions
) => {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function' || document.visibilityState === 'hidden') {
    return;
  }

  const eventKey = `${eventName}:${options?.eventID ?? JSON.stringify(data ?? {})}`;
  const now = performance.now();
  const lastFiredAt = recentEventKeys.get(eventKey) ?? 0;
  if (now - lastFiredAt < DUPLICATE_EVENT_WINDOW_MS) return;
  recentEventKeys.set(eventKey, now);
  if (recentEventKeys.size > 80) {
    const cutoff = now - 5000;
    recentEventKeys.forEach((timestamp, key) => {
      if (timestamp < cutoff) recentEventKeys.delete(key);
    });
  }

  const action: FacebookPixelAction = STANDARD_EVENTS.has(eventName) ? 'track' : 'trackCustom';
  const hasData = Boolean(data && Object.keys(data).length > 0);
  const hasOptions = Boolean(options && Object.keys(options).length > 0);

  if (hasData && hasOptions) {
    window.fbq(action, eventName, data, options);
    return;
  }

  if (hasData) {
    window.fbq(action, eventName, data);
    return;
  }

  if (hasOptions) {
    window.fbq(action, eventName, undefined, options);
    return;
  }

  window.fbq(action, eventName);
};

export const readCookieValue = (name: string): string => {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  if (!match) return '';
  return decodeURIComponent(match.slice(prefix.length));
};
