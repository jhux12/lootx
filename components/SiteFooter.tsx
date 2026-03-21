import React from 'react';
import { BrandLockup } from './BrandLockup';
import { Instagram, Twitter, Youtube, ShieldCheck, Mail, Dice5 } from 'lucide-react';
import { useGame } from '../context/GameContext';

const socialLinks = [
  { label: 'Twitter', icon: Twitter },
  { label: 'Instagram', icon: Instagram },
  { label: 'YouTube', icon: Youtube }
];

const footerColumns = [
  {
    title: 'Platform',
    links: [
      { label: 'Profile', action: 'PROFILE' },
      { label: 'Boxes', action: 'BOXES' },
      { label: 'Provably Fair', action: 'PROVABLY_FAIR' },
      { label: 'Contact', action: 'CONTACT' }
    ]
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', action: 'TERMS' },
      { label: 'Privacy', action: 'PRIVACY' },
      { label: 'Cookie Settings', action: 'COOKIES' }
    ]
  }
] as const;

export const SiteFooter: React.FC = () => {
  const { setView } = useGame();

  const handleFooterAction = (action: string) => {
    if (action === 'COOKIES') {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new Event('pullz:open-cookie-settings'));
      return;
    }
    setView({ type: action as never });
  };

  return (
    <footer className="mt-20 border-t border-white/6 bg-[#070a12] text-sm text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:px-8">
        <div className="space-y-6">
          <BrandLockup
            className="justify-start"
            logoClassName="h-11 w-11 md:h-12 md:w-12"
            logoWidth={1024}
            logoHeight={1024}
            textClassName="text-lg"
            showTextOnMobile
          />
          <p className="max-w-xl text-sm leading-7 text-slate-400">
            Pullz.gg delivers a cleaner way to open boxes, manage inventory, and request shipments from one calm, mobile-friendly account experience.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: 'Protected', copy: 'Verified checkout and account actions.' },
              { icon: Dice5, title: 'Fair play', copy: 'Provably fair systems remain one tap away.' },
              { icon: Mail, title: 'Support', copy: 'Help and account flows stay easy to access.' }
            ].map(({ icon: Icon, title, copy }) => (
              <div key={title} className="rounded-2xl border border-white/6 bg-white/[0.025] p-4">
                <Icon className="h-4 w-4 text-brand-purple" />
                <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                <p className="mt-1 text-xs leading-6 text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:justify-items-end">
          {footerColumns.map((column) => (
            <div key={column.title} className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{column.title}</h3>
              <div className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <button
                    key={link.label}
                    className="block text-left text-sm text-slate-300 transition hover:text-white"
                    onClick={() => handleFooterAction(link.action)}
                    type="button"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Follow Pullz.gg</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.label}
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
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

      <div className="border-t border-white/6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3 text-slate-300">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[0.7rem] font-semibold">18+</span>
            <p>By accessing this site, you confirm that you are over 18 years old.</p>
          </div>
          <p>&copy; 2026 Pullz.gg. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
