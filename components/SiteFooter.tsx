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
    <footer className="mt-16 border-t border-white/6 bg-[#060b14] py-12 text-sm text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
          <div className="space-y-4">
            <BrandLockup
              className="justify-start"
              logoClassName="h-10 w-10 md:h-12 md:w-12"
              logoWidth={1024}
              logoHeight={1024}
              textClassName="text-lg"
              showTextOnMobile
            />
            <p className="max-w-xl text-sm leading-6 text-slate-400">
              Pullz.gg brings a cleaner way to browse boxes, manage real inventory, and handle rewards from one premium dark interface.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Navigate</p>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <button className="text-left transition hover:text-white" onClick={() => setView({ type: 'TERMS' })} type="button">Terms</button>
                <button className="text-left transition hover:text-white" onClick={() => setView({ type: 'PRIVACY' })} type="button">Privacy</button>
                <button
                  className="text-left transition hover:text-white"
                  onClick={() => {
                    if (typeof window === 'undefined') return;
                    window.dispatchEvent(new Event('pullz:open-cookie-settings'));
                  }}
                  type="button"
                >
                  Cookie Settings
                </button>
                <button className="text-left transition hover:text-white" onClick={() => setView({ type: 'PROVABLY_FAIR' })} type="button">Provably Fair</button>
                <button className="text-left transition hover:text-white" onClick={() => setView({ type: 'CONTACT' })} type="button">Contact</button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Follow Pullz</p>
              <div className="mt-4 flex items-center gap-3">
                {socialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.label}
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                      aria-label={link.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500/12 text-xs font-semibold text-white">
              18+
            </span>
            <p>By accessing this site, you confirm that you are over 18 years old.</p>
          </div>
          <p className="text-xs text-slate-500">&copy; 2026 Pullz.gg. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
