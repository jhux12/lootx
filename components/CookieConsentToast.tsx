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
  const [isExpanded, setIsExpanded] = useState(false);
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
      setIsExpanded(false);
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
    setIsExpanded(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-50 flex justify-center px-2 pb-2 pointer-events-none lg:bottom-3">
      <div className="w-full rounded-2xl border border-white/10 bg-[#0a0f1d]/80 px-3 py-2 shadow-[0_0_18px_rgba(96,40,170,0.25)] backdrop-blur pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              <span className="text-[11px] text-gray-200/90 sm:text-xs">
                Cookies keep your progress saved and gameplay smooth.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="text-[11px] font-semibold text-gray-300 transition hover:text-white"
              >
                Learn more
              </button>
              <button
                type="button"
                onClick={() => handleConsent('essential')}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-200 transition hover:border-white/40 hover:text-white"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => handleConsent('all')}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 px-4 py-1 text-[11px] font-semibold text-white shadow-[0_0_12px_rgba(139,92,246,0.6)] transition hover:brightness-110"
              >
                Accept all
              </button>
            </div>
          </div>
          {isExpanded && (
            <div className="rounded-xl border border-white/10 bg-[#0d1222] px-3 py-2 text-[11px] text-gray-300">
              Essentials keep your account secure and preferences saved. Accept all enables
              analytics to improve gameplay performance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
