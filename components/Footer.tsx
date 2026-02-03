import React from 'react';
import { BrandLockup } from './BrandLockup';
import { Instagram, Twitter, Youtube } from 'lucide-react';

const footerLinks = ['Terms', 'Privacy', 'Support', 'Contact'];

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-white/10 px-4 py-10 text-sm text-gray-500 md:px-0">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-6 md:flex-row">
        <BrandLockup
          className="justify-center md:justify-start"
          logoClassName="h-10"
          textClassName="text-lg"
          showTextOnMobile
        />
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          {footerLinks.map((link) => (
            <button
              key={link}
              type="button"
              className="transition hover:text-gray-300"
            >
              {link}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <button type="button" aria-label="Twitter" className="transition hover:text-gray-300">
            <Twitter className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Instagram" className="transition hover:text-gray-300">
            <Instagram className="h-4 w-4" />
          </button>
          <button type="button" aria-label="YouTube" className="transition hover:text-gray-300">
            <Youtube className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-gray-600">&copy; 2024 Pullz.gg. All rights reserved.</p>
    </footer>
  );
};
