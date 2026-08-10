import React from 'react';
import { ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { User } from '../../types';
import { UserAvatar } from '../UserAvatar';
import { XP_ICON } from '../../constants';
import { AnimatedNumber } from '../../src/ui/numbers/AnimatedNumber';
import { CoinAmount } from '../CoinAmount';

interface QuickAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  isNew?: boolean;
  active?: boolean;
}

type AccountPanel = 'overview' | 'security' | 'settings';

interface AccountSidebarProps {
  user: User;
  username: string;
  memberSince: string;
  xp: number;
  balance: number;
  quickActions: QuickAction[];
  activePanel: AccountPanel;
  onSelectPanel: (panel: AccountPanel) => void;
}

export const AccountSidebar: React.FC<AccountSidebarProps> = ({
  user,
  username,
  memberSince,
  xp,
  balance,
  quickActions,
  activePanel,
  onSelectPanel
}) => {
  const hasShippingAddress = Boolean(
    user.shippingAddress?.fullName
    && user.shippingAddress?.street1
    && user.shippingAddress?.city
    && user.shippingAddress?.postalCode
    && user.shippingAddress?.countryCode
  );
  const profileCompletionChecks = [Boolean(user.name), Boolean(user.email), Boolean(user.avatar), hasShippingAddress];
  const completedChecks = profileCompletionChecks.filter(Boolean).length;
  const profileCompletionPercent = Math.round((completedChecks / profileCompletionChecks.length) * 100);
  const panelButtons = [
    {
      id: 'overview' as const,
      label: 'Overview',
      hint: 'Profile details and status',
      icon: UserRound
    },
    {
      id: 'security' as const,
      label: 'Security',
      hint: 'Email, password, login',
      icon: ShieldCheck
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      hint: 'Address and avatar',
      icon: SlidersHorizontal
    }
  ];

  return (
    <aside className="hidden w-[300px] shrink-0 space-y-4 md:block">
      <section className="rounded-3xl border border-blue-400/20 bg-gradient-to-b from-[#171d31] via-[#141b2d] to-[#101523] p-4 shadow-[0_16px_45px_rgba(11,14,20,0.45)]">
        <div className="flex items-center gap-3.5">
          <UserAvatar user={user} className="h-16 w-16 rounded-2xl bg-[#2a323b]" />
          <div>
            <p className="text-base font-bold text-white">{username}</p>
            <p className="text-xs text-gray-300">Member since {memberSince}</p>
            <p className="mt-1 text-[11px] text-gray-400">{user.email || 'No email linked yet'}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-400/30 bg-blue-500/10 px-2 py-2 text-xs text-white">
            <img src={XP_ICON} alt="XP" className="h-3.5 w-3.5" loading="lazy" decoding="async" width={14} height={14} />
            <AnimatedNumber value={xp} /> XP
          </span>
          <span className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white">
            <CoinAmount amount={balance} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-semibold text-white" iconClassName="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-gray-300">
            <span>Profile completion</span>
            <span className="font-semibold text-white">{profileCompletionPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#205DD7] to-sky-400 transition-all"
              style={{ width: `${profileCompletionPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#1f252c] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Account Sections</p>
        <div className="space-y-2">
          {panelButtons.map((panel) => {
            const Icon = panel.icon;
            const isActive = activePanel === panel.id;
            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => onSelectPanel(panel.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                  isActive
                    ? 'border-blue-400/50 bg-blue-500/20 text-white'
                    : 'border-white/10 bg-white/[0.02] text-gray-300 hover:bg-white/[0.05]'
                }`}
              >
                <span className={`rounded-lg p-1.5 ${isActive ? 'bg-blue-500/30 text-blue-100' : 'bg-white/10 text-gray-300'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{panel.label}</span>
                  <span className="block text-[11px] text-gray-400">{panel.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#1f252c] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Quick Actions</p>
        <div className="space-y-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${
                action.active
                  ? 'border border-blue-400/60 bg-blue-500/20 text-white'
                  : action.primary
                    ? 'bg-gradient-to-r from-[#205DD7] to-sky-500 text-white'
                    : 'border border-white/10 text-gray-200 hover:bg-white/5'
              }`}
            >
              <span>{action.label}</span>
              {action.isNew && <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold">NEW</span>}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
};
