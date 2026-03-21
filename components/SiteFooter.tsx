import React from 'react';
import { BrandLockup } from './BrandLockup';
import { Instagram, Twitter, Youtube } from 'lucide-react';
import { useGame } from '../context/GameContext';

const socialLinks = [
  { label: 'Twitter', icon: Twitter },
  { label: 'Instagram', icon: Instagram },
  { label: 'YouTube', icon: Youtube }
];

export const SiteFooter: React.FC = () => {
  const { setView } = useGame();

  return (
    <footer className="mt-16 px-4 pb-8 pt-4 sm:px-6 sm:pb-10">
      <div className="mx-auto max-w-[1280px] overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,rgba(8,12,22,0.96),rgba(7,10,18,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_rgba(0,0,0,0.28)]">
        <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-5">
            <BrandLockup
              className="justify-start"
              logoClassName="h-10 w-10 md:h-12 md:w-12"
              logoWidth={1024}
              logoHeight={1024}
              textClassName="text-lg"
              showTextOnMobile
            />
            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              Pullz.gg brings premium rewards, transparent odds, and smooth inventory management into one refined experience.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
              <button className="rounded-full bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.08] hover:text-white" onClick={() => setView({ type: 'TERMS' })} type="button">
                Terms
              </button>
              <button className="rounded-full bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.08] hover:text-white" onClick={() => setView({ type: 'PRIVACY' })} type="button">
                Privacy
              </button>
              <button
                className="rounded-full bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.08] hover:text-white"
                onClick={() => {
                  if (typeof window === 'undefined') return;
                  window.dispatchEvent(new Event('pullz:open-cookie-settings'));
                }}
                type="button"
              >
                Cookie Settings
              </button>
              <button className="rounded-full bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.08] hover:text-white" onClick={() => setView({ type: 'PROVABLY_FAIR' })} type="button">
                Provably Fair
              </button>
              <button className="rounded-full bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.08] hover:text-white" onClick={() => setView({ type: 'CONTACT' })} type="button">
                Contact
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:items-end">
            <div className="flex items-center gap-3">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.label}
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
                    aria-label={link.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <div className="flex items-start gap-3 rounded-[24px] bg-white/[0.04] px-4 py-3 text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-[0.7rem] font-semibold text-white">
                18+
              </span>
              <p className="leading-6 text-slate-400">
                By accessing this site, you confirm that you are over 18 years old.
              </p>
            </div>
            <p className="text-xs text-slate-600 lg:text-right">&copy; 2026 Pullz.gg. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
