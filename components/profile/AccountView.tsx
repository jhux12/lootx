import React from 'react';
import { X } from 'lucide-react';
import { AddressValidationResult, ShippingAddress, User } from '../../types';
import { COUNTRY_CODES, COUNTRY_NAMES, countryAddressRules } from '../../src/lib/shippingAddress';

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
  validationResult?: AddressValidationResult | null;
  onAddressChoice: (choice: 'original' | 'suggested') => void;
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
  user, addressForm, setAddressForm, onSaveAddress, validationResult, onAddressChoice, isSavingAddress, securityForm, setSecurityForm,
  onSaveUsername, onSaveEmail, onSavePassword, isSavingUsername, isSavingEmail, isSavingPassword,
  onClose
}) => {
  const updateSecurity = (key: keyof SecurityForm, value: string) => setSecurityForm({ ...securityForm, [key]: value });
  const updateAddress = (key: keyof ShippingAddress, value: string) => setAddressForm({ ...addressForm, [key]: value });
  const rules = countryAddressRules(addressForm.countryCode);
  const addressBlock = (address: ShippingAddress) => <address className="not-italic text-sm leading-6 text-gray-200"><strong>{address.fullName}</strong><br />{address.street1}{address.street2 && <><br />{address.street2}</>}<br />{address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}<br />{COUNTRY_NAMES.of(address.countryCode)}</address>;
  const saveProfile = () => {
    if (securityForm.username.trim() && securityForm.username.trim() !== (user.name ?? '').trim()) onSaveUsername();
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
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Password</legend>
            <div className="space-y-2">
              <input aria-label="Current password" type="password" value={securityForm.currentPassword} onChange={(event) => updateSecurity('currentPassword', event.target.value)} placeholder="Current password" className={inputClassName} />
              <input aria-label="New password" type="password" value={securityForm.newPassword} onChange={(event) => updateSecurity('newPassword', event.target.value)} placeholder="New password" className={inputClassName} />
              <input aria-label="Confirm new password" type="password" value={securityForm.confirmPassword} onChange={(event) => updateSecurity('confirmPassword', event.target.value)} placeholder="Confirm new password" className={inputClassName} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Shipping Address</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Full Name<input autoComplete="name" value={addressForm.fullName} onChange={(e) => updateAddress('fullName', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Country<select autoComplete="country" value={addressForm.countryCode} onChange={(e) => updateAddress('countryCode', e.target.value)} className={`${inputClassName} mt-1 min-h-11`}>{COUNTRY_CODES.map(code => <option key={code} value={code}>{COUNTRY_NAMES.of(code)}</option>)}</select></label>
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Address Line 1<input autoComplete="address-line1" value={addressForm.street1} onChange={(e) => updateAddress('street1', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Address Line 2 <span className="font-normal">(optional)</span><input autoComplete="address-line2" value={addressForm.street2 ?? ''} onChange={(e) => updateAddress('street2', e.target.value)} placeholder="Apt, suite, unit, building, etc." className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">{rules.cityLabel}<input autoComplete="address-level2" value={addressForm.city} onChange={(e) => updateAddress('city', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">{rules.stateLabel}{!rules.stateRequired && <span className="font-normal"> (optional)</span>}<input autoComplete="address-level1" value={addressForm.state ?? ''} onChange={(e) => updateAddress('state', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">{rules.postalLabel}<input autoComplete="postal-code" value={addressForm.postalCode} onChange={(e) => updateAddress('postalCode', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">Phone Number <span className="font-normal">(optional)</span><input type="tel" autoComplete="tel" value={addressForm.phone ?? ''} onChange={(e) => updateAddress('phone', e.target.value)} className={`${inputClassName} mt-1`} /></label>
            </div>
            {validationResult?.status === 'corrected' && validationResult.suggestedAddress && <div className="mt-4 rounded-xl border border-violet-400/40 bg-violet-400/10 p-4"><h3 className="font-black text-white">We found a possible match for your address.</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[10px] font-black tracking-widest text-gray-400">YOU ENTERED</p>{addressBlock(validationResult.originalAddress)}</div><div><p className="mb-1 text-[10px] font-black tracking-widest text-violet-300">SUGGESTED</p>{addressBlock(validationResult.suggestedAddress)}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => onAddressChoice('suggested')} className="min-h-11 rounded-xl bg-violet-500 px-3 font-black text-white">Use Suggested Address</button><button type="button" onClick={() => onAddressChoice('original')} className="min-h-11 rounded-xl border border-white/15 px-3 font-bold text-white">Keep My Address</button></div></div>}
            {validationResult?.status === 'invalid' && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100"><strong>We couldn't verify this address.</strong><p className="mt-1">Please check the street, city, state or province, and postal code.</p></div>}
          </fieldset>

        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/5 hover:text-white">Cancel</button>
          <button type="button" onClick={saveProfile} disabled={isSavingAddress || isSavingUsername || isSavingEmail || isSavingPassword} className="rounded-xl bg-[#f4f4f5] px-4 py-3 text-sm font-black text-[#14151a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{isSavingAddress ? 'Checking address…' : isSavingUsername || isSavingEmail || isSavingPassword ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </section>
    </div>
  );
};
