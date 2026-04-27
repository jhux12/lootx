import React from 'react';
import { User, ShippingAddress } from '../../types';
import { UserAvatar } from '../UserAvatar';
import { XP_ICON } from '../../constants';
import { AnimatedNumber } from '../../src/ui/numbers/AnimatedNumber';
import { CoinAmount } from '../CoinAmount';

interface QuickAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  isNew?: boolean;
}

interface AccountViewProps {
  user: User;
  username: string;
  memberSince: string;
  xp: number;
  balance: number;
  level: number;
  boxesOpened: number;
  totalValueUnboxed: number;
  quickActions: QuickAction[];
  recentActivity: string[];
  addressForm: ShippingAddress;
  setAddressForm: (next: ShippingAddress) => void;
  onSaveAddress: () => void;
  isSavingAddress: boolean;
}

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  username,
  memberSince,
  xp,
  balance,
  level,
  boxesOpened,
  totalValueUnboxed,
  quickActions,
  recentActivity,
  addressForm,
  setAddressForm,
  onSaveAddress,
  isSavingAddress
}) => {
  return (
    <div className="space-y-4 md:hidden">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#151b2d] to-[#101523] p-4">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} className="h-14 w-14 rounded-xl bg-[#0b0f1a]" />
          <div>
            <p className="text-sm font-bold text-white">{username}</p>
            <p className="text-xs text-gray-400">Member since {memberSince}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-1 text-xs text-white">
            <img src={XP_ICON} alt="XP" className="h-3.5 w-3.5" /> <AnimatedNumber value={xp} /> XP
          </span>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white">
            <CoinAmount amount={balance} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-semibold text-white" iconClassName="h-3.5 w-3.5" />
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101523] p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><p className="text-gray-500">Level</p><p className="font-bold text-white">{level}</p></div>
          <div><p className="text-gray-500">Boxes</p><p className="font-bold text-white">{boxesOpened}</p></div>
          <div><p className="text-gray-500">Value</p><p className="font-bold text-white">{Math.round(totalValueUnboxed)}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101523] p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Quick Actions</p>
        <div className="space-y-2">
          {quickActions.map((action) => (
            <button key={action.label} onClick={action.onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${action.primary ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white' : 'border border-white/10 text-gray-200'}`}>
              <span>{action.label}</span>
              {action.isNew && <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold">NEW</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101523] p-4">
        <p className="mb-3 text-xs font-semibold uppercase text-gray-400">Shipping Address</p>
        <div className="grid grid-cols-1 gap-2">
          {([
            ['fullName', 'Full Name'],
            ['street', 'Street'],
            ['city', 'City'],
            ['state', 'State'],
            ['zipCode', 'Zip Code'],
            ['country', 'Country']
          ] as Array<[keyof ShippingAddress, string]>).map(([key, label]) => (
            <input
              key={key}
              value={addressForm[key]}
              onChange={(event) => setAddressForm({ ...addressForm, [key]: event.target.value })}
              placeholder={label}
              className="rounded-xl border border-white/10 bg-[#0b0f1a] px-3 py-2 text-sm text-white outline-none focus:border-purple-400/40"
            />
          ))}
        </div>
        <button onClick={onSaveAddress} disabled={isSavingAddress} className="mt-3 w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-3 py-2 text-sm font-bold text-white">
          {isSavingAddress ? 'Saving...' : 'Save Address'}
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101523] p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Recent Activity</p>
        {recentActivity.length === 0 ? <p className="text-sm text-gray-500">No recent activity yet.</p> : (
          <ul className="space-y-2 text-sm text-gray-300">{recentActivity.map((activity, idx) => <li key={`${activity}-${idx}`}>• {activity}</li>)}</ul>
        )}
      </section>
    </div>
  );
};
