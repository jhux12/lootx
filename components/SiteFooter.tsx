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
    <footer className="mt-20 border-t border-cyan-400/15 bg-transparent py-10 text-sm text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <BrandLockup
            className="justify-start"
            logoClassName="h-10 w-10 md:h-12 md:w-12"
            logoWidth={1024}
            logoHeight={1024}
            textClassName="text-lg"
            showTextOnMobile
          />
          <div className="flex items-center gap-4">
            {socialLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.label}
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/25 bg-[#25313a] text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
                  aria-label={link.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'TERMS' })}
            type="button"
          >
            Terms
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'PRIVACY' })}
            type="button"
          >
            Privacy
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => {
              if (typeof window === 'undefined') return;
              window.dispatchEvent(new Event('pullz:open-cookie-settings'));
            }}
            type="button"
          >
            Cookie Settings
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'PROVABLY_FAIR' })}
            type="button"
          >
            Provably Fair
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'CONTACT' })}
            type="button"
          >
            Contact
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 md:text-sm">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 text-[0.65rem] font-semibold text-white md:h-9 md:w-9 md:text-xs">
            18+
          </span>
          <p className="max-w-2xl text-slate-300">
            By accessing this site, you confirm that you are over 18 years old.
          </p>
        </div>
        <p className="text-xs text-slate-500">&copy; 2026 Pullz.gg. All rights reserved.</p>
      </div>
    </footer>
  );
};
