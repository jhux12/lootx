export const PWA_DISMISSED_STORAGE_KEY = 'pullz.installPrompt.dismissed';
export const PWA_SESSION_SHOWN_KEY = 'pullz.installPrompt.sessionShown';

export const isClient = () => typeof window !== 'undefined';

export const isStandaloneMode = () => {
  if (!isClient()) return false;

  const iosStandalone = typeof navigator !== 'undefined' && 'standalone' in navigator
    ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    : false;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;

  return iosStandalone || mediaStandalone;
};

export const isIosDevice = () => {
  if (!isClient()) return false;
  const ua = window.navigator.userAgent;

  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isSafariBrowser = () => {
  if (!isClient()) return false;
  const ua = window.navigator.userAgent;

  return /Safari/i.test(ua)
    && !/CriOS|Chrome|EdgiOS|FxiOS|OPiOS|SamsungBrowser/i.test(ua);
};

export const isIosSafari = () => isIosDevice() && isSafariBrowser();

export const supportsInstallPromptEvent = () => {
  if (!isClient()) return false;
  return !isIosSafari();
};

export const wasDismissedPermanently = () => {
  if (!isClient()) return false;
  return window.localStorage.getItem(PWA_DISMISSED_STORAGE_KEY) === '1';
};

export const markDismissedPermanently = () => {
  if (!isClient()) return;
  window.localStorage.setItem(PWA_DISMISSED_STORAGE_KEY, '1');
};

export const wasShownThisSession = () => {
  if (!isClient()) return false;
  return window.sessionStorage.getItem(PWA_SESSION_SHOWN_KEY) === '1';
};

export const markShownThisSession = () => {
  if (!isClient()) return;
  window.sessionStorage.setItem(PWA_SESSION_SHOWN_KEY, '1');
};
