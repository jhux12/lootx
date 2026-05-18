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

interface AccountViewProps {
  user: User;
  username: string;
  memberSince: string;
  xp: number;
  balance: number;
  quickActions: QuickAction[];
  activePanel: AccountPanel;
  onSelectPanel: (panel: AccountPanel) => void;
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

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  username,
  memberSince,
  xp,
  balance,
  quickActions,
  activePanel,
  onSelectPanel,
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
  const usernameChanged = securityForm.username.trim() !== (user.name ?? '').trim() && securityForm.username.trim().length > 0;
  const emailChanged = securityForm.email.trim() !== (user.email ?? '').trim() && securityForm.email.trim().length > 0;
  const canUpdateEmail = emailChanged && securityForm.currentPassword.trim().length > 0;
  const canUpdatePassword = securityForm.currentPassword.trim().length > 0 && securityForm.newPassword.trim().length > 0 && securityForm.confirmPassword.trim().length > 0;
  const hasShippingAddress = Boolean(
    user.shippingAddress?.fullName
    && user.shippingAddress?.street
    && user.shippingAddress?.city
    && user.shippingAddress?.zipCode
    && user.shippingAddress?.country
  );
  const authProviderLabel = user.provider === 'google' ? 'Google' : user.provider === 'password' ? 'Email + Password' : 'Standard';
  const inputClassName = 'w-full rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20';
  const panelOptions: Array<{ id: AccountPanel; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'security', label: 'Security' },
    { id: 'settings', label: 'Settings' }
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-blue-400/20 bg-gradient-to-b from-[#171d31] via-[#141b2d] to-[#101523] p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} className="h-16 w-16 rounded-2xl bg-[#2a323b]" />
            <div>
              <p className="text-lg font-bold text-white">{username}</p>
              <p className="text-xs text-gray-300">Member since {memberSince}</p>
              <p className="mt-1 text-[11px] text-gray-400">{user.email || 'No email linked yet'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-white">
              <img src={XP_ICON} alt="XP" className="h-3.5 w-3.5" loading="lazy" decoding="async" width={14} height={14} />
              <AnimatedNumber value={xp} /> XP
            </span>
            <span className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
              <CoinAmount amount={balance} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-semibold text-white" iconClassName="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#1f252c] p-3">
        <div className="grid grid-cols-3 gap-2">
          {panelOptions.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => onSelectPanel(panel.id)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activePanel === panel.id
                  ? 'bg-gradient-to-r from-[#205DD7] to-sky-500 text-white shadow-[0_8px_24px_rgba(32,93,215,0.35)]'
                  : 'border border-white/10 text-gray-300 hover:bg-white/[0.05]'
              }`}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </section>

      {activePanel === 'overview' && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Account Status</p>
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-gray-200">Username: <span className="font-semibold text-white">{username}</span></p>
                <p className="text-gray-200">Login Method: <span className="font-semibold text-white">{authProviderLabel}</span></p>
                <p className="text-gray-200">Email: <span className={user.email ? 'font-semibold text-white' : 'font-semibold text-amber-200'}>{user.email || 'Not connected'}</span></p>
              </div>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Fulfillment</p>
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-gray-200">
                  Shipping profile:
                  <span className={`ml-1 font-semibold ${hasShippingAddress ? 'text-emerald-300' : 'text-amber-200'}`}>
                    {hasShippingAddress ? 'Ready' : 'Needs address'}
                  </span>
                </p>
                <p className="text-gray-300">Add your address to speed up future shipping requests.</p>
                <button
                  type="button"
                  onClick={() => onSelectPanel('settings')}
                  className="rounded-lg border border-blue-400/40 bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-500/25"
                >
                  Open Settings
                </button>
              </div>
            </article>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Shortcuts</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    action.active
                      ? 'border border-blue-400/50 bg-blue-500/20 text-white'
                      : 'border border-white/10 text-gray-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <span>{action.label}</span>
                  {action.isNew ? <span className="ml-2 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold">NEW</span> : null}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {activePanel === 'security' && (
        <section className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <h3 className="text-sm font-semibold text-white">Identity</h3>
            <p className="mt-1 text-xs text-gray-400">Update your username and email used for account notifications.</p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="text-xs font-semibold text-gray-300">Username</label>
              <input value={securityForm.username} onChange={(event) => setSecurityForm({ ...securityForm, username: event.target.value })} placeholder="Username" className={inputClassName} />
              <button
                onClick={onSaveUsername}
                disabled={isSavingUsername || !usernameChanged}
                className="rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingUsername ? 'Saving Username...' : 'Update Username'}
              </button>

              <label className="mt-1 text-xs font-semibold text-gray-300">Email</label>
              <input value={securityForm.email} onChange={(event) => setSecurityForm({ ...securityForm, email: event.target.value })} placeholder="Email" className={inputClassName} />
              <label className="text-xs font-semibold text-gray-300">Current Password</label>
              <input type="password" value={securityForm.currentPassword} onChange={(event) => setSecurityForm({ ...securityForm, currentPassword: event.target.value })} placeholder="Current Password" className={inputClassName} />
              <button
                onClick={onSaveEmail}
                disabled={isSavingEmail || !canUpdateEmail}
                className="rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingEmail ? 'Saving Email...' : 'Update Email'}
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <h3 className="text-sm font-semibold text-white">Password</h3>
            <p className="mt-1 text-xs text-gray-400">Keep your account secure with a strong, unique password.</p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="text-xs font-semibold text-gray-300">New Password</label>
              <input type="password" value={securityForm.newPassword} onChange={(event) => setSecurityForm({ ...securityForm, newPassword: event.target.value })} placeholder="New Password" className={inputClassName} />
              <label className="text-xs font-semibold text-gray-300">Confirm New Password</label>
              <input type="password" value={securityForm.confirmPassword} onChange={(event) => setSecurityForm({ ...securityForm, confirmPassword: event.target.value })} placeholder="Confirm New Password" className={inputClassName} />
              <button
                onClick={onSavePassword}
                disabled={isSavingPassword || !canUpdatePassword}
                className="rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingPassword ? 'Saving Password...' : 'Update Password'}
              </button>
            </div>
          </article>
        </section>
      )}

      {activePanel === 'settings' && (
        <section className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <h3 className="text-sm font-semibold text-white">Shipping Address</h3>
            <p className="mt-1 text-xs text-gray-400">Used for physical reward shipments.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                ['fullName', 'Full Name'],
                ['street', 'Street Address'],
                ['city', 'City'],
                ['state', 'State / Region'],
                ['zipCode', 'ZIP / Postal Code'],
                ['country', 'Country']
              ] as Array<[keyof ShippingAddress, string]>).map(([key, label]) => (
                <label key={key} className={key === 'street' ? 'sm:col-span-2' : undefined}>
                  <span className="mb-1 block text-xs font-semibold text-gray-300">{label}</span>
                  <input value={addressForm[key]} onChange={(event) => setAddressForm({ ...addressForm, [key]: event.target.value })} placeholder={label} className={inputClassName} />
                </label>
              ))}
            </div>
            <button onClick={onSaveAddress} disabled={isSavingAddress} className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isSavingAddress ? 'Saving...' : 'Save Address'}
            </button>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <h3 className="text-sm font-semibold text-white">Profile Picture</h3>
            <p className="mt-1 text-xs text-gray-400">Pick a style that stands out in chat and drops.</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {avatarOptions.map((avatar) => (
                <button
                  type="button"
                  key={avatar}
                  onClick={() => setSecurityForm({ ...securityForm, avatar })}
                  className={`overflow-hidden rounded-xl border-2 transition ${securityForm.avatar === avatar ? 'border-blue-400 shadow-[0_0_20px_rgba(32,93,215,0.35)]' : 'border-white/10 hover:border-blue-300/40'}`}
                >
                  <img src={avatar} alt="avatar option" className="h-12 w-full object-cover" loading="lazy" decoding="async" width={96} height={48} />
                </button>
              ))}
            </div>
            <button onClick={onSaveAvatar} disabled={isSavingAvatar} className="mt-3 w-full rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
              {isSavingAvatar ? 'Saving...' : 'Save Profile Picture'}
            </button>
          </article>
        </section>
      )}
    </div>
  );
};
