import React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { profileAvatars } from '../../assets/profileAvatars';
import { ShippingAddress, User } from '../../types';

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
  onClose: () => void;
}

const inputClassName = 'w-full rounded-lg border border-white/10 bg-[#f4f4f5] px-3 py-2.5 text-sm font-medium text-[#16171d] outline-none transition placeholder:text-gray-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30';

export const AccountView: React.FC<AccountViewProps> = ({
  user, addressForm, setAddressForm, onSaveAddress, isSavingAddress, securityForm, setSecurityForm,
  onSaveUsername, onSaveEmail, onSavePassword, isSavingUsername, isSavingEmail, isSavingPassword,
  onClose
}) => {
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = React.useState(false);
  const updateSecurity = (key: keyof SecurityForm, value: string) => setSecurityForm({ ...securityForm, [key]: value });
  const updateAddress = (key: keyof ShippingAddress, value: string) => setAddressForm({ ...addressForm, [key]: value });
  const saveProfile = () => {
    if (securityForm.username.trim() && (securityForm.username.trim() !== (user.name ?? '').trim() || securityForm.avatar !== (user.avatar || user.photoURL || ''))) onSaveUsername();
    if (securityForm.email.trim() && securityForm.email.trim() !== (user.email ?? '').trim() && securityForm.currentPassword.trim()) onSaveEmail();
    if (securityForm.currentPassword && securityForm.newPassword && securityForm.confirmPassword) onSavePassword();
    onSaveAddress();
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <section className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#15151b] px-5 pb-7 pt-3 shadow-2xl sm:max-h-[90dvh] sm:rounded-[1.75rem] sm:px-7">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <header className="mt-4 flex items-center justify-between gap-4">
          <h2 id="edit-profile-title" className="text-xl font-black tracking-[-0.03em] text-white">Edit Profile</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white" aria-label="Close edit profile"><X className="h-5 w-5" /></button>
        </header>

        <div className="mt-7 space-y-7">
          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Account</legend>
            <div className="space-y-2">
              <input aria-label="Username" value={securityForm.username} onChange={(event) => updateSecurity('username', event.target.value)} placeholder="Username" className={inputClassName} />
              <input aria-label="Email address" type="email" value={securityForm.email} onChange={(event) => updateSecurity('email', event.target.value)} placeholder="Email address" className={inputClassName} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-xs font-black uppercase tracking-wider text-gray-500">Profile Picture</legend>
            <p className="mb-3 text-xs text-gray-400">Choose an avatar for your public profile.</p>
            <button
              type="button"
              aria-expanded={isAvatarPickerOpen}
              aria-controls="profile-picture-options"
              onClick={() => setIsAvatarPickerOpen((isOpen) => !isOpen)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0d0d11] p-2.5 text-left transition hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              {securityForm.avatar ? <img src={securityForm.avatar} alt="Current profile picture" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white">?</span>}
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{isAvatarPickerOpen ? 'Hide profile pictures' : 'Choose profile picture'}</span><span className="block truncate text-xs text-gray-400">{profileAvatars.length} available pictures</span></span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isAvatarPickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {isAvatarPickerOpen ? <div id="profile-picture-options" className="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-5" role="radiogroup" aria-label="Profile picture">
              {profileAvatars.map((avatar) => {
                const isSelected = securityForm.avatar === avatar.src;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select profile picture ${avatar.id}`}
                    onClick={() => updateSecurity('avatar', avatar.src)}
                    className={`relative aspect-square min-w-0 overflow-hidden rounded-full border-2 bg-[#0d0d11] transition focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-[#15151b] ${isSelected ? 'border-violet-400 shadow-[0_0_0_2px_rgba(167,139,250,0.25)]' : 'border-transparent hover:border-white/40'}`}
                  >
                    <img src={avatar.src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    {isSelected ? <span className="absolute inset-0 grid place-items-center bg-black/35 text-white"><Check className="h-5 w-5" strokeWidth={3} /></span> : null}
                  </button>
                );
              })}
            </div> : null}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Password</legend>
            <div className="space-y-2">
              <input aria-label="Current password" type="password" value={securityForm.currentPassword} onChange={(event) => updateSecurity('currentPassword', event.target.value)} placeholder="Current password" className={inputClassName} />
              <input aria-label="New password" type="password" value={securityForm.newPassword} onChange={(event) => updateSecurity('newPassword', event.target.value)} placeholder="New password" className={inputClassName} />
              <input aria-label="Confirm new password" type="password" value={securityForm.confirmPassword} onChange={(event) => updateSecurity('confirmPassword', event.target.value)} placeholder="Confirm new password" className={inputClassName} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Shipping Address</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={addressForm.fullName} onChange={(event) => updateAddress('fullName', event.target.value)} placeholder="Full name" className={`${inputClassName} sm:col-span-2`} />
              <input value={addressForm.street} onChange={(event) => updateAddress('street', event.target.value)} placeholder="Address line 1" className={`${inputClassName} sm:col-span-2`} />
              <input value={addressForm.city} onChange={(event) => updateAddress('city', event.target.value)} placeholder="City" className={inputClassName} />
              <input value={addressForm.state} onChange={(event) => updateAddress('state', event.target.value)} placeholder="State / region" className={inputClassName} />
              <input value={addressForm.zipCode} onChange={(event) => updateAddress('zipCode', event.target.value)} placeholder="ZIP / postal code" className={inputClassName} />
              <input value={addressForm.country} onChange={(event) => updateAddress('country', event.target.value)} placeholder="Country" className={inputClassName} />
            </div>
          </fieldset>

        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/5 hover:text-white">Cancel</button>
          <button type="button" onClick={saveProfile} disabled={isSavingAddress || isSavingUsername || isSavingEmail || isSavingPassword} className="rounded-xl bg-[#f4f4f5] px-4 py-3 text-sm font-black text-[#14151a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{isSavingAddress || isSavingUsername || isSavingEmail || isSavingPassword ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </section>
    </div>
  );
};
