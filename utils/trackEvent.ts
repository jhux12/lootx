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

  const hasData = Boolean(data && Object.keys(data).length > 0);
  window.fbq('track', eventName, ...(hasData ? [data] : []));
};
