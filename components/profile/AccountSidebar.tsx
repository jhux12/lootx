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
  active?: boolean;
}

type AccountPanel = 'overview' | 'security' | 'settings';

interface SecurityForm {
  username: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  avatar: string;
}

interface AccountSidebarProps {
  user: User;
  username: string;
  memberSince: string;
  xp: number;
  balance: number;
  quickActions: QuickAction[];
  activePanel: AccountPanel;
  addressForm: ShippingAddress;
  setAddressForm: (next: ShippingAddress) => void;
  onSaveAddress: () => void;
  isSavingAddress: boolean;
  securityForm: SecurityForm;
  setSecurityForm: (next: SecurityForm) => void;
  onSaveUsername: () => void;
  onSaveEmail: () => void;
  onSavePassword: () => void;
  isSavingUsername: boolean;
  isSavingEmail: boolean;
  isSavingPassword: boolean;
  avatarOptions: string[];
  onSaveAvatar: () => void;
  isSavingAvatar: boolean;
}

export const AccountSidebar: React.FC<AccountSidebarProps> = ({
  user,
  username,
  memberSince,
  xp,
  balance,
  quickActions,
  activePanel,
  addressForm,
  setAddressForm,
  onSaveAddress,
  isSavingAddress,
  securityForm,
  setSecurityForm,
  onSaveUsername,
  onSaveEmail,
  onSavePassword,
  isSavingUsername,
  isSavingEmail,
  isSavingPassword,
  avatarOptions,
  onSaveAvatar,
  isSavingAvatar
}) => {
  return (
    <aside className="hidden w-[280px] shrink-0 space-y-4 md:block">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#151b2d] to-[#101523] p-4">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} className="h-14 w-14 rounded-xl bg-[#2a323b]" />
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

      <section className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Quick Actions</p>
        <div className="space-y-2">
          {quickActions.map((action) => (
            <button key={action.label} onClick={action.onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${action.active ? 'border border-purple-400/60 bg-purple-500/20 text-white' : action.primary ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white' : 'border border-white/10 text-gray-200 hover:bg-white/5'}`}>
              <span>{action.label}</span>
              {action.isNew && <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold">NEW</span>}
            </button>
          ))}
        </div>
      </section>

      {activePanel === 'security' && (
        <section className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-gray-400">Security</p>
          <div className="grid grid-cols-1 gap-2">
            <input value={securityForm.username} onChange={(e) => setSecurityForm({ ...securityForm, username: e.target.value })} placeholder="Username" className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white" />
            <button onClick={onSaveUsername} disabled={isSavingUsername} className="rounded-xl border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-sm font-bold text-purple-100 disabled:opacity-50">
              {isSavingUsername ? 'Saving Username...' : 'Update Username'}
            </button>
            <input value={securityForm.email} onChange={(e) => setSecurityForm({ ...securityForm, email: e.target.value })} placeholder="Email" className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white" />
            <input type="password" value={securityForm.currentPassword} onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })} placeholder="Current Password" className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white" />
            <button onClick={onSaveEmail} disabled={isSavingEmail} className="rounded-xl border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-sm font-bold text-purple-100 disabled:opacity-50">
              {isSavingEmail ? 'Saving Email...' : 'Update Email'}
            </button>
            <input type="password" value={securityForm.newPassword} onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })} placeholder="New Password" className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white" />
            <input type="password" value={securityForm.confirmPassword} onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })} placeholder="Confirm New Password" className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white" />
            <button onClick={onSavePassword} disabled={isSavingPassword} className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
              {isSavingPassword ? 'Saving Password...' : 'Update Password'}
            </button>
          </div>
        </section>
      )}

      {activePanel === 'settings' && (
        <section className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-gray-400">Settings: Shipping Address</p>
          <div className="grid grid-cols-1 gap-2">
            {([
              ['fullName', 'Full Name'],
              ['street', 'Street'],
              ['city', 'City'],
              ['state', 'State'],
              ['zipCode', 'Zip Code'],
              ['country', 'Country']
            ] as Array<[keyof ShippingAddress, string]>).map(([key, label]) => (
              <input key={key} value={addressForm[key]} onChange={(e) => setAddressForm({ ...addressForm, [key]: e.target.value })} placeholder={label} className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white" />
            ))}
          </div>
          <p className="mt-3 mb-2 text-xs font-semibold uppercase text-gray-400">Profile Picture</p>
          <div className="grid grid-cols-5 gap-2">
            {avatarOptions.map((avatar) => (
              <button
                type="button"
                key={avatar}
                onClick={() => setSecurityForm({ ...securityForm, avatar })}
                className={`overflow-hidden rounded-xl border-2 ${securityForm.avatar === avatar ? 'border-purple-400' : 'border-white/10'}`}
              >
                <img src={avatar} alt="avatar option" className="h-10 w-full object-cover" />
              </button>
            ))}
          </div>
          <button onClick={onSaveAvatar} disabled={isSavingAvatar} className="mt-3 w-full rounded-xl border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-sm font-bold text-purple-100">
            {isSavingAvatar ? 'Saving...' : 'Save Profile Picture'}
          </button>
          <button onClick={onSaveAddress} disabled={isSavingAddress} className="mt-3 w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-3 py-2 text-sm font-bold text-white">
            {isSavingAddress ? 'Saving...' : 'Save Address'}
          </button>
        </section>
      )}
    </aside>
  );
};
