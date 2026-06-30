export const GA_MEASUREMENT_ID = 'G-LV7CLC8P2R';

type GtagParameters = Record<string, unknown>;

type GtagFn = (
  command: string,
  targetOrEventName: string | Date,
  parameters?: GtagParameters
) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
    __pullzGaLastPagePath?: string;
  }
}

const isGaAvailable = () => (
  typeof window !== 'undefined' &&
  typeof window.gtag === 'function'
);

export function trackGaPageView(
  pagePath: string,
  pageTitle?: string
): boolean {
  if (!isGaAvailable()) {
    return false;
  }

  window.gtag?.('event', 'page_view', {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: pageTitle ?? document.title
  });

  return true;
}

export function trackGaEvent(
  eventName: string,
  parameters?: GtagParameters
): boolean {
  if (!isGaAvailable()) {
    return false;
  }

  window.gtag?.('event', eventName, parameters ?? {});
  return true;
}
