import React from 'react';
import { BrandLockup } from './BrandLockup';
import { Twitter, Instagram, Youtube } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-white/5 py-10 text-sm text-gray-500">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <BrandLockup
            className="justify-start"
            logoClassName="h-10"
            textClassName="text-lg"
            showTextOnMobile
          />
          <div className="flex items-center gap-3">
            <button aria-label="Twitter" className="rounded-full border border-white/10 p-2 text-gray-400 transition-colors hover:text-white">
              <Twitter className="h-4 w-4" />
            </button>
            <button aria-label="Instagram" className="rounded-full border border-white/10 p-2 text-gray-400 transition-colors hover:text-white">
              <Instagram className="h-4 w-4" />
            </button>
            <button aria-label="YouTube" className="rounded-full border border-white/10 p-2 text-gray-400 transition-colors hover:text-white">
              <Youtube className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
          <span className="cursor-pointer transition-colors hover:text-gray-300">Terms</span>
          <span className="cursor-pointer transition-colors hover:text-gray-300">Privacy</span>
          <span className="cursor-pointer transition-colors hover:text-gray-300">Support</span>
          <span className="cursor-pointer transition-colors hover:text-gray-300">Contact</span>
        </div>
        <p className="text-xs text-gray-600">&copy; 2024 Pullz.gg. All rights reserved.</p>
      </div>
    </footer>
  );
};
