import React, { useEffect, useRef, useState } from 'react';
import { MapPin, UserRound, X } from 'lucide-react';
import { AddressAutocompleteSuggestion, AddressValidationResult, ShippingAddress, User } from '../../types';
import { COUNTRY_CODES, COUNTRY_NAMES, countryAddressRules } from '../../src/lib/shippingAddress';
import { auth } from '../../firebase';

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
  onSaveUsername: () => Promise<boolean>;
  onSaveEmail: () => Promise<boolean>;
  onSavePassword: () => Promise<boolean>;
  isSavingUsername: boolean;
  isSavingEmail: boolean;
  isSavingPassword: boolean;
  onClose: () => void;
}

const inputClassName = 'w-full rounded-lg border border-white/10 bg-[#f4f4f5] px-3 py-2.5 text-sm font-medium text-[#16171d] outline-none transition placeholder:text-gray-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30';

export const AccountView: React.FC<AccountViewProps> = ({
  user, activePanel, onSelectPanel, addressForm, setAddressForm, onSaveAddress, validationResult, onAddressChoice, isSavingAddress, securityForm, setSecurityForm,
  onSaveUsername, onSaveEmail, onSavePassword, isSavingUsername, isSavingEmail, isSavingPassword,
  onClose
}) => {
  const updateSecurity = (key: keyof SecurityForm, value: string) => setSecurityForm({ ...securityForm, [key]: value });
  const updateAddress = (key: keyof ShippingAddress, value: string) => setAddressForm({ ...addressForm, [key]: value });
  const rules = countryAddressRules(addressForm.countryCode);
  const [suggestions, setSuggestions] = useState<AddressAutocompleteSuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const skipNextSearch = useRef(false);
  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    const query = addressForm.street1.trim();
    if (activePanel !== 'settings' || query.length < 3) { setSuggestions([]); setIsSearchingAddress(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const params = new URLSearchParams({ q: query, countryCode: addressForm.countryCode });
        const response = await fetch(`/api/shipping/address-suggestions?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const payload = await response.json();
        if (response.ok) { setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []); setSuggestionsOpen(true); }
      } catch (error) { if ((error as Error).name !== 'AbortError') setSuggestions([]); }
      finally { if (!controller.signal.aborted) setIsSearchingAddress(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activePanel, addressForm.street1, addressForm.countryCode]);
  const chooseSuggestion = (suggestion: AddressAutocompleteSuggestion) => {
    skipNextSearch.current = true; setSuggestionsOpen(false); setSuggestions([]);
    setAddressForm({ ...addressForm, ...suggestion.address, validated: false, validationStatus: 'unvalidated', validatedAt: null, shippoAddressId: null });
  };
  const addressBlock = (address: ShippingAddress) => <address className="not-italic text-sm leading-6 text-gray-200"><strong>{address.fullName}</strong><br />{address.street1}{address.street2 && <><br />{address.street2}</>}<br />{address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}<br />{COUNTRY_NAMES.of(address.countryCode)}</address>;
  const saveAccount = async () => {
    const usernameChanged = Boolean(securityForm.username.trim() && securityForm.username.trim() !== (user.name ?? '').trim());
    const emailChanged = Boolean(securityForm.email.trim() && securityForm.email.trim() !== (user.email ?? '').trim());
    const passwordChanged = Boolean(securityForm.newPassword || securityForm.confirmPassword);
    if (!usernameChanged && !emailChanged && !passwordChanged) return;
    // Avoid overlapping reauthentication and token refresh operations on slower mobile connections.
    if (usernameChanged && !(await onSaveUsername())) return;
    if (emailChanged && !(await onSaveEmail())) return;
    if (passwordChanged) await onSavePassword();
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <section className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#15151b] px-5 pb-7 pt-3 shadow-2xl sm:max-h-[90dvh] sm:rounded-[1.75rem] sm:px-7">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <header className="mt-4 flex items-center justify-between gap-4">
          <h2 id="edit-profile-title" className="text-xl font-black tracking-[-0.03em] text-white">Edit Profile</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white" aria-label="Close edit profile"><X className="h-5 w-5" /></button>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-black/25 p-1" role="tablist" aria-label="Profile settings">
          <button type="button" role="tab" aria-selected={activePanel !== 'settings'} onClick={() => onSelectPanel('overview')} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${activePanel !== 'settings' ? 'bg-white text-[#16171d] shadow' : 'text-gray-400 hover:text-white'}`}><UserRound className="h-4 w-4" />Account</button>
          <button type="button" role="tab" aria-selected={activePanel === 'settings'} onClick={() => onSelectPanel('settings')} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${activePanel === 'settings' ? 'bg-white text-[#16171d] shadow' : 'text-gray-400 hover:text-white'}`}><MapPin className="h-4 w-4" />Shipping</button>
        </div>

        <div className="mt-6 space-y-7">
          {activePanel !== 'settings' && <>
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
          </>}

          {activePanel === 'settings' && <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Shipping Address</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Full Name<input autoComplete="name" value={addressForm.fullName} onChange={(e) => updateAddress('fullName', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Country<select autoComplete="country" value={addressForm.countryCode} onChange={(e) => updateAddress('countryCode', e.target.value)} className={`${inputClassName} mt-1 min-h-11`}>{COUNTRY_CODES.map(code => <option key={code} value={code}>{COUNTRY_NAMES.of(code)}</option>)}</select></label>
              <label className="relative sm:col-span-2 text-xs font-bold text-gray-400">Address Line 1
                <input autoComplete="address-line1" value={addressForm.street1} onChange={(e) => updateAddress('street1', e.target.value)} onFocus={() => suggestions.length && setSuggestionsOpen(true)} onKeyDown={(e) => { if (e.key === 'Escape') setSuggestionsOpen(false); }} aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls="shipping-address-suggestions" className={`${inputClassName} mt-1`} />
                {isSearchingAddress && <span className="absolute right-3 top-8 text-xs font-semibold text-gray-500">Searching…</span>}
                {suggestionsOpen && suggestions.length > 0 && <ul id="shipping-address-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-[#202129] p-1 shadow-2xl shadow-black/60">
                  {suggestions.map((suggestion) => <li key={suggestion.id} role="option"><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseSuggestion(suggestion)} className="flex min-h-12 w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold leading-5 text-gray-100 transition hover:bg-violet-500/20 focus:bg-violet-500/20 focus:outline-none"><MapPin className="mt-0.5 h-4 w-4 flex-none text-violet-300" /><span>{suggestion.label}</span></button></li>)}
                </ul>}
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-gray-400">Address Line 2 <span className="font-normal">(optional)</span><input autoComplete="address-line2" value={addressForm.street2 ?? ''} onChange={(e) => updateAddress('street2', e.target.value)} placeholder="Apt, suite, unit, building, etc." className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">{rules.cityLabel}<input autoComplete="address-level2" value={addressForm.city} onChange={(e) => updateAddress('city', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">{rules.stateLabel}{!rules.stateRequired && <span className="font-normal"> (optional)</span>}<input autoComplete="address-level1" value={addressForm.state ?? ''} onChange={(e) => updateAddress('state', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">{rules.postalLabel}<input autoComplete="postal-code" value={addressForm.postalCode} onChange={(e) => updateAddress('postalCode', e.target.value)} className={`${inputClassName} mt-1`} /></label>
              <label className="text-xs font-bold text-gray-400">Phone Number <span className="font-normal">(optional)</span><input type="tel" autoComplete="tel" value={addressForm.phone ?? ''} onChange={(e) => updateAddress('phone', e.target.value)} className={`${inputClassName} mt-1`} /></label>
            </div>
            {validationResult?.status === 'corrected' && validationResult.suggestedAddress && <div className="mt-4 rounded-xl border border-violet-400/40 bg-violet-400/10 p-4"><h3 className="font-black text-white">We found a possible match for your address.</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[10px] font-black tracking-widest text-gray-400">YOU ENTERED</p>{addressBlock(validationResult.originalAddress)}</div><div><p className="mb-1 text-[10px] font-black tracking-widest text-violet-300">SUGGESTED</p>{addressBlock(validationResult.suggestedAddress)}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => onAddressChoice('suggested')} className="min-h-11 rounded-xl bg-violet-500 px-3 font-black text-white">Use Suggested Address</button><button type="button" onClick={() => onAddressChoice('original')} className="min-h-11 rounded-xl border border-white/15 px-3 font-bold text-white">Keep My Address</button></div></div>}
            {validationResult?.status === 'inconclusive' && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><strong>We couldn't fully verify this address with the carrier.</strong><p className="mt-1">Please confirm that the address is correct before continuing.</p><button type="button" onClick={() => onAddressChoice('original')} className="mt-3 min-h-11 w-full rounded-xl bg-amber-300 px-3 font-black text-slate-950 sm:w-auto">Confirm Address</button></div>}
            {validationResult?.status === 'invalid' && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100"><strong>We couldn't verify this address.</strong><ul className="mt-1 list-disc pl-5">{(validationResult.messages?.length ? validationResult.messages : ['Please review the highlighted address details.']).map((message) => <li key={message}>{message}</li>)}</ul></div>}
          </fieldset>}

        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/5 hover:text-white">Cancel</button>
          <button type="button" onClick={activePanel === 'settings' ? onSaveAddress : () => void saveAccount()} disabled={isSavingAddress || isSavingUsername || isSavingEmail || isSavingPassword} className="min-h-12 rounded-xl bg-[#f4f4f5] px-4 py-3 text-sm font-black text-[#14151a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{activePanel === 'settings' && isSavingAddress ? 'Checking address…' : isSavingUsername || isSavingEmail || isSavingPassword ? 'Saving…' : activePanel === 'settings' ? 'Save Address' : 'Save Account'}</button>
        </div>
      </section>
    </div>
  );
};
