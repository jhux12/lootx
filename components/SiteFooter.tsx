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
    <footer className="mt-20 border-t border-white/5 bg-[#070a12] py-10 text-sm text-gray-500">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <BrandLockup
            className="justify-start"
            logoClassName="h-10 md:h-12"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/30 hover:text-white"
                  aria-label={link.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          <button className="transition hover:text-white">Terms</button>
          <button className="transition hover:text-white">Privacy</button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'CONTACT' })}
            type="button"
          >
            Support
          </button>
          <button
            className="transition hover:text-white"
            onClick={() => setView({ type: 'CONTACT' })}
            type="button"
          >
            Contact
          </button>
        </div>
        <p className="text-xs text-gray-600">&copy; 2024 LootX. All rights reserved.</p>
      </div>
    </footer>
  );
};
