import React from 'react';
import { BrandLockup } from './BrandLockup';
import { AtSign, Facebook, Instagram, Twitter } from 'lucide-react';
import { useGame } from '../context/GameContext';
import applePayIcon from '../assets/svgicons/Size=lg, Payment method=ApplePay.png';
import discoverIcon from '../assets/svgicons/Size=lg, Payment method=Discover.png';
import googlePayIcon from '../assets/svgicons/Size=lg, Payment method=GooglePay.png';
import klarnaIcon from '../assets/svgicons/Size=lg, Payment method=Klarna.png';
import mastercardIcon from '../assets/svgicons/Size=lg, Payment method=Mastercard.png';
import shopPayIcon from '../assets/svgicons/Size=lg, Payment method=Shop Pay.png';
import stripeIcon from '../assets/svgicons/Size=lg, Payment method=Stripe.png';
import visaIcon from '../assets/svgicons/Size=lg, Payment method=Visa.png';


const paymentMethods = [
  { src: visaIcon, label: 'Visa' },
  { src: mastercardIcon, label: 'Mastercard' },
  { src: applePayIcon, label: 'Apple Pay' },
  { src: googlePayIcon, label: 'Google Pay' },
  { src: shopPayIcon, label: 'Shop Pay' },
  { src: discoverIcon, label: 'Discover' },
  { src: stripeIcon, label: 'Stripe' },
  { src: klarnaIcon, label: 'Klarna' }
];

const socialLinks = [
  {
    href: 'https://www.instagram.com/pullz.gg/',
    label: 'Follow Pullz.gg on Instagram',
    Icon: Instagram
  },
  {
    href: 'https://www.facebook.com/pullzgg',
    label: 'Follow Pullz.gg on Facebook',
    Icon: Facebook
  },
  {
    href: 'https://x.com/pullzgg',
    label: 'Follow Pullz.gg on X',
    Icon: Twitter
  },
  {
    href: 'https://www.threads.com/@pullz.gg',
    label: 'Follow Pullz.gg on Threads',
    Icon: AtSign
  }
];

export const SiteFooter: React.FC = () => {
  const { setView } = useGame();

  return (
    <footer className="mt-20 border-t border-cyan-400/15 bg-transparent py-10 text-sm text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
        <section
          className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_18px_60px_rgba(8,13,20,0.18)] backdrop-blur-sm sm:p-5"
          aria-labelledby="accepted-payments-heading"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="accepted-payments-heading" className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                Accepted payments
              </h2>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">Fast, secure checkout options for every device.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4 sm:flex sm:flex-wrap sm:justify-end" aria-label="Accepted payment methods">
              {paymentMethods.map(({ src, label }) => (
                <div
                  key={label}
                  className="flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white px-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-cyan-950/20 sm:h-11 sm:min-w-[5.35rem]"
                  title={label}
                >
                  <img src={src} alt={label} className="max-h-5 w-auto object-contain" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <BrandLockup
            className="justify-start"
            logoClassName="h-10 w-10 md:h-12 md:w-12"
            logoWidth={1024}
            logoHeight={1024}
            textClassName="text-lg"
            showTextOnMobile
          />
          <div className="grid w-full grid-cols-4 gap-2 text-white sm:w-auto sm:flex sm:items-center sm:gap-3" aria-label="Pullz.gg social links">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 min-w-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-slate-200 transition-colors hover:border-cyan-300/25 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/70 sm:h-10 sm:w-10 sm:rounded-full sm:border-cyan-400/25 sm:bg-[#25313a]"
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
