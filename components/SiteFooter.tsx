import React from 'react';
import { BrandLockup } from './BrandLockup';
import { Twitter, Instagram, Youtube } from 'lucide-react';

export const SiteFooter: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-white/5 pb-10 pt-12 text-sm text-gray-500">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 md:flex-row md:items-center md:justify-between md:px-0">
        <div className="flex flex-col gap-4">
          <BrandLockup
            className="justify-start"
            logoClassName="h-10"
            textClassName="text-lg"
            showTextOnMobile
          />
          <p className="max-w-xs text-xs text-gray-500">
            Premium mystery boxes with real rewards, designed for fast play and verified fairness.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          <span className="cursor-pointer transition-colors hover:text-gray-300">Terms</span>
          <span className="cursor-pointer transition-colors hover:text-gray-300">Privacy</span>
          <span className="cursor-pointer transition-colors hover:text-gray-300">Support</span>
          <span className="cursor-pointer transition-colors hover:text-gray-300">Contact</span>
        </div>
        <div className="flex items-center gap-4 text-gray-500">
          <button className="rounded-full border border-white/10 p-2 transition-colors hover:text-white">
            <Twitter className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-white/10 p-2 transition-colors hover:text-white">
            <Instagram className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-white/10 p-2 transition-colors hover:text-white">
            <Youtube className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-white/5 pt-6 px-4 text-xs text-gray-600 md:px-0">
        &copy; 2024 Pullz.gg. All rights reserved.
      </div>
    </footer>
  );
};
