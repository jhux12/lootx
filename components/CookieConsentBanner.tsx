import React, { useEffect, useMemo, useState } from 'react';
import {
  CookieConsentValue,
  getCookieConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  loadMarketingScripts,
  setCookieConsent
} from '../utils/cookieConsent';

type CookieConsentBannerProps = {
  onAnalyticsConsent?: () => void;
};

const CATEGORY_OPTIONS = [
  {
    id: 'essential',
    title: 'Essential',
    description: 'Authentication, security, and preferences.'
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Gameplay insights and experience improvements.'
  },
  {
    id: 'marketing',
    title: 'Marketing / Ads',
    description: 'Reserved for future offers.'
  }
];

const getSelectedFromConsent = (consent: CookieConsentValue | null) => ({
  essential: true,
  analytics: consent === 'analytics' || consent === 'all' || consent === null,
  marketing: consent === 'all' || consent === null
});

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onAnalyticsConsent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    essential: true,
    analytics: true,
    marketing: true
  });

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent) {
      setSelected(getSelectedFromConsent(consent));
      setIsOpen(true);
      return;
    }
    setSelected(getSelectedFromConsent(consent));
    setIsOpen(false);
    if (hasAnalyticsConsent(consent)) {
      onAnalyticsConsent?.();
    }
    if (hasMarketingConsent(consent)) {
      loadMarketingScripts();
    }
  }, [onAnalyticsConsent]);

  useEffect(() => {
    const reopen = () => {
      const consent = getCookieConsent();
      setSelected(getSelectedFromConsent(consent));
      setIsOpen(true);
    };
    window.addEventListener('pullz:open-cookie-settings', reopen);
    return () => window.removeEventListener('pullz:open-cookie-settings', reopen);
  }, []);

  const consentValue: CookieConsentValue = useMemo(() => {
    if (selected.marketing) return 'all';
    if (selected.analytics) return 'analytics';
    return 'essential';
  }, [selected.analytics, selected.marketing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 rounded-2xl border border-white/10 bg-[#0a0f1d]/95 p-5 shadow-[0_0_35px_rgba(96,40,170,0.35)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-white">We use cookies to power your wins 🍪</p>
          <p className="text-sm text-gray-300">
            They keep your account secure, save your progress, and help us improve gameplay.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                if (category.id === 'essential') return;
                setSelected((prev) => ({
                  ...prev,
                  [category.id]: !prev[category.id]
                }));
              }}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0d1222] p-3 text-left transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={category.id === 'essential'}
              aria-pressed={selected[category.id]}
              aria-disabled={category.id === 'essential'}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{category.title}</span>
                <span
                  className={`inline-flex h-5 w-9 items-center rounded-full border border-white/10 px-0.5 transition ${
                    selected[category.id] ? 'bg-purple-500/80' : 'bg-white/5'
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white transition ${
                      selected[category.id] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </div>
              <p className="text-xs text-gray-400">{category.description}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">No ads right now. You’re always in control.</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              className="w-full rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/40 hover:text-white sm:w-auto"
              onClick={() => {
                setCookieConsent('essential');
                setIsOpen(false);
              }}
            >
              Essential Only
            </button>
            <button
              type="button"
              className="w-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.55)] transition hover:opacity-90 sm:w-auto"
              onClick={() => {
                setCookieConsent(consentValue);
                if (hasAnalyticsConsent(consentValue)) {
                  onAnalyticsConsent?.();
                }
                if (hasMarketingConsent(consentValue)) {
                  loadMarketingScripts();
                }
                setIsOpen(false);
              }}
            >
              Accept &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
