import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  Facebook,
  Headphones,
  Instagram,
  Mail,
  ShieldCheck,
  Twitter,
  UsersRound,
} from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { useGame } from '../context/GameContext';
import { PaymentMethodIcons } from './PaymentMethodIcons';

type FooterView =
  | 'ABOUT'
  | 'FAQ'
  | 'TERMS'
  | 'PRIVACY'
  | 'PROVABLY_FAIR'
  | 'SHIPPING_POLICY'
  | 'REFUND_POLICY'
  | 'CONTACT';

const socialLinks = [
  { href: 'https://www.instagram.com/pullz.gg/', label: 'Follow Pullz.gg on Instagram', Icon: Instagram },
  { href: 'https://www.facebook.com/pullzgg', label: 'Follow Pullz.gg on Facebook', Icon: Facebook },
  { href: 'https://x.com/pullzgg', label: 'Follow Pullz.gg on X', Icon: Twitter },
  { href: 'mailto:support@pullz.gg', label: 'Email Pullz.gg support', Icon: Mail },
];

const footerSections: Array<{
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  links: Array<{ label: string; view?: FooterView; href?: string; cookieSettings?: boolean }>;
}> = [
  {
    title: 'Company',
    Icon: Building2,
    links: [
      { label: 'About', view: 'ABOUT' },
      { label: 'Provably Fair', view: 'PROVABLY_FAIR' },
      { label: 'Terms of Service', view: 'TERMS' },
      { label: 'Privacy Policy', view: 'PRIVACY' },
      { label: 'Cookie Settings', cookieSettings: true },
    ],
  },
  {
    title: 'Support',
    Icon: Headphones,
    links: [
      { label: 'FAQ', view: 'FAQ' },
      { label: 'Shipping Policy', view: 'SHIPPING_POLICY' },
      { label: 'Refund Policy', view: 'REFUND_POLICY' },
      { label: 'Contact Us', view: 'CONTACT' },
    ],
  },
  {
    title: 'Connect',
    Icon: UsersRound,
    links: socialLinks.map(({ href, label }) => ({ href, label })),
  },
];

export const SiteFooter: React.FC = () => {
  const { setView } = useGame();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const followFooterLink = (link: (typeof footerSections)[number]['links'][number]) => {
    if (link.cookieSettings) {
      window.dispatchEvent(new Event('pullz:open-cookie-settings'));
    } else if (link.view) {
      setView({ type: link.view });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="mt-20 border-t border-violet-300/15 bg-[#05060a] text-sm text-slate-300">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 md:py-12">
        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <button
              type="button"
              onClick={() => setView({ type: 'HOME' })}
              className="inline-flex min-h-11 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              aria-label="Go to Pullz home"
            >
              <BrandLockup className="justify-start" logoClassName="h-11 w-auto md:h-10" />
            </button>
            <p className="mt-4 text-base leading-7 text-slate-300 md:text-sm md:leading-6">
              Open real boxes. Win real items.<br />Keep it or sell it back.
            </p>
            <div className="mt-5 grid max-w-[280px] grid-cols-4 gap-3" aria-label="Pullz.gg social links">
              {socialLinks.map(({ href, label, Icon }) => (
                <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-slate-100 transition hover:border-violet-400/40 hover:bg-violet-500/10 focus:outline-none focus:ring-2 focus:ring-violet-300/70 md:h-10 md:w-10 md:rounded-full" aria-label={label}>
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div className="hidden gap-12 md:flex">
            {footerSections.slice(0, 2).map(({ title, links }) => (
              <div key={title}>
                <h2 className="font-bold uppercase tracking-[0.18em] text-slate-200">{title}</h2>
                <div className="mt-4 flex flex-col items-start gap-3 text-slate-400">
                  {links.map((link) => <FooterLink key={link.label} link={link} onSelect={followFooterLink} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="my-7 h-px bg-white/10" />
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-4 sm:px-5">
          <PaymentMethodIcons className="flex-nowrap justify-between gap-1.5 overflow-hidden" iconClassName="h-6 min-w-0 sm:h-7" />
        </div>

        <div className="mt-6 space-y-3 md:hidden">
          {footerSections.map(({ title, Icon, links }) => {
            const isOpen = openSection === title;
            return (
              <section key={title} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.018]">
                <button type="button" onClick={() => setOpenSection(isOpen ? null : title)} className="flex min-h-[72px] w-full items-center gap-5 px-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400" aria-expanded={isOpen}>
                  <Icon className="h-6 w-6 text-violet-400" />
                  <span className="flex-1 text-sm font-bold uppercase tracking-[0.16em] text-slate-200">{title}</span>
                  <ChevronDown className={`h-6 w-6 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 px-5 py-3">{links.map((link) => <FooterLink key={link.label} link={link} onSelect={followFooterLink} />)}</div>}
              </section>
            );
          })}
        </div>

        <div className="mt-7 flex items-center gap-4 rounded-2xl border border-white/10 border-l-violet-500 bg-white/[0.025] p-5 md:max-w-2xl">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-violet-500 text-xs font-semibold text-white">18+</span>
          <p className="text-sm leading-6 text-slate-300 sm:text-base">By accessing this site, you confirm that you are over 18 years old.</p>
        </div>

        <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:text-sm">
          <ShieldCheck className="h-7 w-7 shrink-0 text-violet-400" />
          <p>&copy; {new Date().getFullYear()} Pullz.gg. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

const FooterLink: React.FC<{
  link: (typeof footerSections)[number]['links'][number];
  onSelect: (link: (typeof footerSections)[number]['links'][number]) => void;
}> = ({ link, onSelect }) => link.href ? (
  <a href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="min-h-11 py-3 text-xs transition hover:text-white focus:outline-none focus-visible:text-white md:min-h-0 md:py-0 md:text-sm">{link.label.replace('Follow Pullz.gg on ', '')}</a>
) : (
  <button type="button" onClick={() => onSelect(link)} className="min-h-11 py-3 text-left text-xs transition hover:text-white focus:outline-none focus-visible:text-white md:min-h-0 md:py-0 md:text-sm">{link.label}</button>
);
