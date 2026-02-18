import React from 'react';
import {
  Box,
  Facebook,
  HelpCircle,
  Instagram,
  RefreshCw,
  Shield,
  Swords,
  Tag,
  Trophy,
  Twitter,
  Youtube,
  LifeBuoy,
  X
} from 'lucide-react';
import { ViewState } from '../types';
import { BrandLockup } from './BrandLockup';

type MobileMenuPageProps = {
  isAuthenticated: boolean;
  onNavigate: (view: ViewState) => void;
  onLogin: () => void;
  onRegister: () => void;
};

type MenuCard = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  view?: ViewState;
  requiresAuth?: boolean;
};

const sectionLabelClassName = 'text-[12px] sm:text-[13px] font-black uppercase tracking-[0.2em] text-white';

const GAMES: MenuCard[] = [
  { label: 'Boxes', icon: Box, iconClassName: 'text-[#ff7a00]', view: { type: 'BOXES' } },
  { label: 'Battles', icon: Swords, iconClassName: 'text-[#ff3f4e]', view: { type: 'BATTLES' } }
];

const REWARDS: MenuCard[] = [
  { label: 'Daily Spin', icon: RefreshCw, iconClassName: 'text-[#4188ff]', view: { type: 'BONUSES' }, requiresAuth: true },
  { label: 'Leaderboard', icon: Trophy, iconClassName: 'text-[#ffc300]', view: { type: 'LEADERBOARD' } }
];

const LEARN: MenuCard[] = [
  { label: 'Blog', icon: Tag, iconClassName: 'text-gray-400', view: { type: 'HOME' } },
  { label: 'FAQ', icon: HelpCircle, iconClassName: 'text-gray-400', view: { type: 'HOME' } },
  { label: 'Fairness', icon: Shield, iconClassName: 'text-emerald-400', view: { type: 'PROVABLY_FAIR' } }
];

const SUPPORT: MenuCard[] = [
  { label: 'Support', icon: LifeBuoy, iconClassName: 'text-gray-200', view: { type: 'CONTACT' } }
];

const navItemClassName =
  'flex w-full items-center gap-4 rounded-[22px] border border-white/10 bg-gradient-to-r from-[#151821] to-[#13151d] px-6 py-5 text-left';

const MenuCardButton: React.FC<{
  card: MenuCard;
  isAuthenticated: boolean;
  onNavigate: (view: ViewState) => void;
  onLogin: () => void;
}> = ({ card, isAuthenticated, onNavigate, onLogin }) => {
  const Icon = card.icon;

  return (
    <button
      type="button"
      onClick={() => {
        if (card.requiresAuth && !isAuthenticated) {
          onLogin();
          return;
        }

        if (card.view) {
          onNavigate(card.view);
        }
      }}
      className={navItemClassName}
    >
      <Icon className={`h-7 w-7 ${card.iconClassName}`} />
      <span className="text-[21px] font-extrabold text-white">{card.label}</span>
    </button>
  );
};

export const MobileMenuPage: React.FC<MobileMenuPageProps> = ({ isAuthenticated, onNavigate, onLogin, onRegister }) => {
  return (
    <section className="mx-auto block max-w-[850px] px-6 pb-[190px] pt-4 lg:hidden">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onNavigate({ type: 'HOME' })} className="inline-flex items-center">
          <BrandLockup />
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ type: 'BOXES' })}
          className="rounded-lg p-2 text-gray-300"
          aria-label="Close menu"
        >
          <X className="h-8 w-8" />
        </button>
      </div>

      <div className="space-y-7">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onLogin}
            className="rounded-[22px] bg-[#554bff] py-7 text-[18px] sm:text-[20px] font-extrabold text-white"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="rounded-[22px] border border-white/10 bg-gradient-to-r from-[#151821] to-[#13151d] py-7 text-[18px] sm:text-[20px] font-extrabold text-white"
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          <h2 className={sectionLabelClassName}>Games</h2>
          <div className="grid grid-cols-2 gap-4">
            {GAMES.map((card) => (
              <MenuCardButton key={card.label} card={card} isAuthenticated={isAuthenticated} onNavigate={onNavigate} onLogin={onLogin} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className={sectionLabelClassName}>Rewards</h2>
          <div className="grid grid-cols-2 gap-4">
            {REWARDS.map((card) => (
              <MenuCardButton key={card.label} card={card} isAuthenticated={isAuthenticated} onNavigate={onNavigate} onLogin={onLogin} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className={sectionLabelClassName}>Learn</h2>
          <div className="grid grid-cols-2 gap-4">
            {LEARN.slice(0, 2).map((card) => (
              <MenuCardButton key={card.label} card={card} isAuthenticated={isAuthenticated} onNavigate={onNavigate} onLogin={onLogin} />
            ))}
          </div>
          <MenuCardButton card={LEARN[2]} isAuthenticated={isAuthenticated} onNavigate={onNavigate} onLogin={onLogin} />
        </div>

        <div className="space-y-4">
          <h2 className={sectionLabelClassName}>Info and Support</h2>
          {SUPPORT.map((card) => (
            <MenuCardButton key={card.label} card={card} isAuthenticated={isAuthenticated} onNavigate={onNavigate} onLogin={onLogin} />
          ))}
        </div>

        <div className="space-y-5 pt-5 text-center">
          <h2 className={sectionLabelClassName}>Social Media</h2>
          <div className="flex items-center justify-center gap-8 text-white">
            <Facebook className="h-6 w-6" />
            <Instagram className="h-6 w-6" />
            <Youtube className="h-6 w-6" />
            <Twitter className="h-6 w-6" />
          </div>
          <div className="space-y-1 text-[12px] sm:text-[13px] font-bold text-gray-400">
            <button type="button" onClick={() => onNavigate({ type: 'TERMS' })} className="px-3">Terms of Service</button>
            <span className="px-3">|</span>
            <button type="button" onClick={() => onNavigate({ type: 'PRIVACY' })} className="px-3">Privacy Policy</button>
            <div>
              <button type="button" onClick={() => onNavigate({ type: 'TERMS' })}>AML &amp; KYC Policy</button>
            </div>
          </div>
        </div>
      </div>


    </section>
  );
};
