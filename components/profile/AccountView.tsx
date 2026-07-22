import React from 'react';
import { X } from 'lucide-react';
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
  avatarOptions: string[];
  onSaveAvatar: () => void;
  isSavingAvatar: boolean;
  onClose: () => void;
}

const inputClassName = 'w-full rounded-lg border border-white/10 bg-[#f4f4f5] px-3 py-2.5 text-sm font-medium text-[#16171d] outline-none transition placeholder:text-gray-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30';

export const AccountView: React.FC<AccountViewProps> = ({
  user, addressForm, setAddressForm, onSaveAddress, isSavingAddress, securityForm, setSecurityForm,
  onSaveUsername, onSaveEmail, onSavePassword, isSavingUsername, isSavingEmail, isSavingPassword,
  avatarOptions, onSaveAvatar, isSavingAvatar, onClose
}) => {
  const updateSecurity = (key: keyof SecurityForm, value: string) => setSecurityForm({ ...securityForm, [key]: value });
  const updateAddress = (key: keyof ShippingAddress, value: string) => setAddressForm({ ...addressForm, [key]: value });
  const saveProfile = () => {
    if (securityForm.username.trim() && securityForm.username.trim() !== (user.name ?? '').trim()) onSaveUsername();
    onSaveAddress();
    if (securityForm.avatar && securityForm.avatar !== user.avatar) onSaveAvatar();
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
              <button type="button" onClick={onSaveEmail} disabled={isSavingEmail || !securityForm.currentPassword.trim()} className="text-xs font-bold text-violet-300 disabled:opacity-40">{isSavingEmail ? 'Updating email…' : 'Update email with current password below'}</button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Password</legend>
            <div className="space-y-2">
              <input aria-label="Current password" type="password" value={securityForm.currentPassword} onChange={(event) => updateSecurity('currentPassword', event.target.value)} placeholder="Current password" className={inputClassName} />
              <input aria-label="New password" type="password" value={securityForm.newPassword} onChange={(event) => updateSecurity('newPassword', event.target.value)} placeholder="New password" className={inputClassName} />
              <input aria-label="Confirm new password" type="password" value={securityForm.confirmPassword} onChange={(event) => updateSecurity('confirmPassword', event.target.value)} placeholder="Confirm new password" className={inputClassName} />
              <button type="button" onClick={onSavePassword} disabled={isSavingPassword || !securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword} className="text-xs font-bold text-violet-300 disabled:opacity-40">{isSavingPassword ? 'Updating password…' : 'Update password'}</button>
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

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Profile Picture</legend>
            <div className="grid grid-cols-5 gap-2">
              {avatarOptions.map((avatar) => <button type="button" key={avatar} onClick={() => updateSecurity('avatar', avatar)} className={`overflow-hidden rounded-xl border-2 ${securityForm.avatar === avatar ? 'border-violet-400' : 'border-transparent opacity-60 hover:opacity-100'}`}><img src={avatar} alt="Avatar option" className="h-11 w-full bg-white/5 object-cover" /></button>)}
            </div>
          </fieldset>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/5 hover:text-white">Cancel</button>
          <button type="button" onClick={saveProfile} disabled={isSavingAddress || isSavingUsername || isSavingAvatar} className="rounded-xl bg-[#f4f4f5] px-4 py-3 text-sm font-black text-[#14151a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{isSavingAddress || isSavingUsername || isSavingAvatar ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </section>
    </div>
  );
};
