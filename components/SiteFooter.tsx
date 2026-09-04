import React from 'react';
import { BrandLockup } from './BrandLockup';
import { AtSign, Facebook, Instagram, Twitter } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { PaymentMethodIcons } from './PaymentMethodIcons';
import { useTheme } from '../src/lib/theme/useTheme';


const socialLinks = [
  {
    href: 'https://www.instagram.com/ripza.gg/',
    label: 'Follow Ripza on Instagram',
    Icon: Instagram
  },
  {
    href: 'https://www.facebook.com/ripzagg',
    label: 'Follow Ripza on Facebook',
    Icon: Facebook
  },
  {
    href: 'https://x.com/ripzagg',
    label: 'Follow Ripza on X',
    Icon: Twitter
  },
  {
    href: 'https://www.threads.com/@ripza.gg',
    label: 'Follow Ripza on Threads',
    Icon: AtSign
  }
];

export const SiteFooter: React.FC = () => {
  const { setView } = useGame();
  const { theme } = useTheme();

  return (
    <footer className="bet-site-footer mt-20 py-10 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
        <PaymentMethodIcons className="px-2" iconClassName="h-5 sm:h-6" />
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => setView({ type: 'HOME' })}
            className="inline-flex min-h-11 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            aria-label="Go to Ripza home"
          >
            <BrandLockup className="justify-start" variant={theme === 'light' ? 'light' : 'dark'} logoClassName="h-9 w-auto md:h-10" />
          </button>
          <div className="grid w-full grid-cols-4 gap-2 text-white sm:w-auto sm:flex sm:items-center sm:gap-3" aria-label="Ripza social links">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 min-w-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-slate-200 transition-colors hover:border-violet-300/35 hover:bg-violet-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/70 sm:h-10 sm:w-10 sm:rounded-full sm:border-violet-300/25 sm:bg-violet-500/10"
                aria-label={label}
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'ABOUT' })}
            type="button"
          >
            About
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'FAQ' })}
            type="button"
          >
            FAQ
          </button>
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
            Cookie settings
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
            onClick={() => setView({ type: 'SHIPPING_POLICY' })}
            type="button"
          >
            Shipping
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'REFUND_POLICY' })}
            type="button"
          >
            Refunds
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
        <p className="text-xs text-slate-500">&copy; 2026 Ripza. All rights reserved.</p>
      </div>
    </footer>
  );
};
