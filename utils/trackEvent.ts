type TrackEventData = Record<string, unknown>;

type FacebookPixelAction = 'track' | 'trackCustom';
type FacebookPixelFn = (action: FacebookPixelAction, eventName: string, data?: TrackEventData) => void;

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
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return;
  }

  const action: FacebookPixelAction = STANDARD_EVENTS.has(eventName) ? 'track' : 'trackCustom';
  const hasData = Boolean(data && Object.keys(data).length > 0);
  window.fbq(action, eventName, ...(hasData ? [data] : []));
};
