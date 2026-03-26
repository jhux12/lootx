type TrackEventData = Record<string, unknown>;

type FacebookPixelFn = (action: 'track', eventName: string, data?: TrackEventData) => void;

declare global {
  interface Window {
    fbq?: FacebookPixelFn;
  }
}

export const trackEvent = (eventName: string, data?: TrackEventData) => {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return;
  }

  if (data && Object.keys(data).length > 0) {
    window.fbq('track', eventName, data);
    return;
  }

  window.fbq('track', eventName);
};
