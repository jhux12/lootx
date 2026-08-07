import React, { useEffect, useRef, useState } from 'react';
import { ConfirmationResult, linkWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import { auth, db } from '../firebase';
import { useGame } from '../context/GameContext';
import { Input } from './ui/Input';
import { PHONE_VERIFICATION_REQUEST_EVENT } from '../utils/phoneVerification';
import { lockPageScroll } from '../utils/scrollLock';
import { getPhoneAuthErrorCode, getPhoneAuthErrorMessage, getPhoneCodeErrorMessage } from '../utils/phoneAuthErrors';
import { CountryCode, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

type VerificationReason = 'free_box' | 'daily_spin';

const countryNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const COUNTRY_OPTIONS = getCountries()
  .map((country) => ({
    country,
    callingCode: `+${getCountryCallingCode(country)}`,
    name: countryNames?.of(country) ?? country
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const splitPhoneNumber = (value?: string) => {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  return {
    country: parsed?.country ?? 'US' as CountryCode,
    nationalNumber: parsed?.nationalNumber ?? ''
  };
};

export const PhoneVerificationModal: React.FC = () => {
  const { user } = useGame();
  const [reason, setReason] = useState<VerificationReason | null>(null);
  const initialPhone = splitPhoneNumber(user.phoneNumber);
  const [country, setCountry] = useState<CountryCode>(initialPhone.country);
  const [nationalNumber, setNationalNumber] = useState(initialPhone.nationalNumber);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: VerificationReason }>).detail;
      setReason(detail?.reason === 'daily_spin' ? 'daily_spin' : 'free_box');
      const existingPhone = splitPhoneNumber(user.phoneNumber);
      setCountry(existingPhone.country);
      setNationalNumber(existingPhone.nationalNumber);
      setPhoneNumber('');
      setCode('');
      setConfirmation(null);
      setMessage(null);
    };
    window.addEventListener(PHONE_VERIFICATION_REQUEST_EVENT, open);
    return () => window.removeEventListener(PHONE_VERIFICATION_REQUEST_EVENT, open);
  }, [user.phoneNumber]);

  useEffect(() => {
    if (!reason) return undefined;
    return lockPageScroll({ preserveScrollPosition: true });
  }, [reason]);

  useEffect(() => () => verifierRef.current?.clear(), []);

  if (!reason) return null;

  const close = () => {
    verifierRef.current?.clear();
    verifierRef.current = null;
    setReason(null);
  };

  const sendCode = async () => {
    const digits = nationalNumber.replace(/\D/g, '');
    const parsed = parsePhoneNumberFromString(`+${getCountryCallingCode(country)}${digits}`, country);
    if (!parsed?.isValid()) {
      setMessage('Enter a valid mobile phone number.');
      return;
    }
    const normalized = parsed.number;
    const currentUser = auth.currentUser;
    if (!currentUser) return setMessage('Please sign in again to verify your phone.');

    setLoading(true);
    setMessage(null);
    try {
      verifierRef.current?.clear();
      const verifier = new RecaptchaVerifier(auth, 'phone-verification-recaptcha', { size: 'invisible' });
      verifierRef.current = verifier;
      await verifier.render();
      const result = await linkWithPhoneNumber(currentUser, normalized, verifier);
      setConfirmation(result);
      setPhoneNumber(normalized);
      setMessage('We sent a 6-digit verification code to your phone.');
    } catch (error: unknown) {
      verifierRef.current?.clear();
      verifierRef.current = null;
      const code = getPhoneAuthErrorCode(error);
      console.error('Phone verification code request failed', { code });
      setMessage(getPhoneAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation || !/^\d{6}$/.test(code)) {
      setMessage('Enter the 6-digit code from the text message.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await confirmation.confirm(code);

      // Linking the credential is the source of truth. Do not report a valid code
      // as expired if the optional profile mirror fails after Firebase accepted it.
      try {
        await result.user.getIdToken(true);
      } catch (error) {
        console.error('Phone verified, but the session token could not refresh', error);
        setMessage('Phone verified, but your session could not refresh. Check your connection, then try the reward again.');
        return;
      }

      void updateDoc(doc(db, 'users', result.user.uid), { phoneNumber }).catch((error) => {
        console.error('Phone verified, but the profile phone mirror could not update', error);
      });
      setMessage('Phone verified.');
      window.setTimeout(close, 700);
    } catch (error: unknown) {
      setMessage(getPhoneCodeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-end justify-center bg-black/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="phone-verification-title">
      <div className="max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-[#18181b] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300"><ShieldCheck className="h-6 w-6" /></div>
            <div><h2 id="phone-verification-title" className="text-xl font-black text-white">Verify your phone</h2><p className="mt-1 text-sm leading-5 text-neutral-400">Required before {reason === 'daily_spin' ? 'using the daily spin' : 'opening your free box'}.</p></div>
          </div>
          <button type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-neutral-400" aria-label="Close phone verification"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6 space-y-4">
          {!confirmation ? <>
            <label htmlFor="verification-phone" className="block text-xs font-semibold text-neutral-300">Mobile phone number</label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
              <label className="min-w-0"><span className="sr-only">Country code</span><select aria-label="Country code" value={country} onChange={(event) => setCountry(event.target.value as CountryCode)} className="min-h-12 w-full truncate rounded-[14px] border border-white/10 bg-[#0b101a] px-3 text-sm text-white/90 outline-none focus:border-white/30 focus:ring-2 focus:ring-cyan-400/40">
                {COUNTRY_OPTIONS.map((option) => <option key={option.country} value={option.country}>{option.name} ({option.callingCode})</option>)}
              </select></label>
              <div className="relative min-w-0"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-sm text-white/60">+{getCountryCallingCode(country)}</span><Input id="verification-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={nationalNumber} onChange={(event) => setNationalNumber(event.target.value)} className="min-h-12 pl-[4.5rem] pr-3" placeholder="555 123 4567" /></div>
            </div>
            <button type="button" onClick={sendCode} disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#205DD7] px-4 font-bold text-white disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Send verification code</button>
          </> : <>
            <label htmlFor="verification-code" className="block text-xs font-semibold text-neutral-300">6-digit verification code</label>
            <Input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="min-h-14 text-center text-xl font-bold tracking-[0.35em]" placeholder="000000" />
            <button type="button" onClick={verifyCode} disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#205DD7] px-4 font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Verify phone</button>
            <button type="button" onClick={() => { setConfirmation(null); setCode(''); setMessage(null); }} className="min-h-11 w-full text-sm font-semibold text-blue-300">Use a different number</button>
          </>}
          {message && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-5 text-neutral-200" aria-live="polite">{message}</p>}
          <div id="phone-verification-recaptcha" />
        </div>
      </div>
    </div>
  );
};
