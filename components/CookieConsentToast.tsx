import React, { useEffect, useRef, useState } from 'react';
import {
  CookieConsentValue,
  getCookieConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  loadMarketingScripts,
  setCookieConsent
} from '../utils/cookieConsent';

type CookieConsentToastProps = {
  onAnalyticsConsent?: () => void;
  isPromoVisible?: boolean;
};

const PROMO_DELAY_MS = 7000;
const AUTO_HIDE_MS = 15000;

export const CookieConsentToast: React.FC<CookieConsentToastProps> = ({
  onAnalyticsConsent,
  isPromoVisible
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const autoHideTimer = useRef<number | null>(null);
  const promoTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (autoHideTimer.current) {
      window.clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
    if (promoTimer.current) {
      window.clearTimeout(promoTimer.current);
      promoTimer.current = null;
    }
  };

  useEffect(() => {
    const consent = getCookieConsent();
    if (consent) {
      if (hasAnalyticsConsent(consent)) {
        onAnalyticsConsent?.();
      }
      if (hasMarketingConsent(consent)) {
        loadMarketingScripts();
      }
      return;
    }

    if (isPromoVisible) {
      promoTimer.current = window.setTimeout(() => {
        setIsOpen(true);
      }, PROMO_DELAY_MS);
    } else {
      setIsOpen(true);
    }

    return clearTimers;
  }, [isPromoVisible, onAnalyticsConsent]);

  useEffect(() => {
    if (!isOpen) return;
    autoHideTimer.current = window.setTimeout(() => {
      setIsOpen(false);
    }, AUTO_HIDE_MS);
    return () => {
      if (autoHideTimer.current) {
        window.clearTimeout(autoHideTimer.current);
        autoHideTimer.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const reopen = () => {
      setIsOpen(true);
    };
    window.addEventListener('pullz:open-cookie-settings', reopen);
    return () => window.removeEventListener('pullz:open-cookie-settings', reopen);
  }, []);

  const handleConsent = (value: CookieConsentValue) => {
    setCookieConsent(value);
    if (hasAnalyticsConsent(value)) {
      onAnalyticsConsent?.();
    }
    if (hasMarketingConsent(value)) {
      loadMarketingScripts();
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-2 pointer-events-none">
      <div className="w-full rounded-full border border-white/10 bg-[#0a0f1d]/70 px-3 py-2 shadow-[0_0_18px_rgba(96,40,170,0.25)] backdrop-blur pointer-events-none">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
            <span className="text-[11px] text-gray-200/90 sm:text-xs truncate max-w-[70vw]">
              Cookies keep your progress saved and gameplay smooth.
            </span>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              title="Essential only"
              aria-label="Essential only"
              onClick={() => handleConsent('essential')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-gray-200 transition hover:border-white/40 hover:text-white"
            >
              ⚙️
            </button>
            <button
              type="button"
              title="Accept & Continue"
              aria-label="Accept & Continue"
              onClick={() => handleConsent('all')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 text-xs text-white shadow-[0_0_10px_rgba(139,92,246,0.45)] transition hover:opacity-90"
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
