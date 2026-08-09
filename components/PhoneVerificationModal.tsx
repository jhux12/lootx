import React, { useEffect, useRef, useState } from 'react';
import { ConfirmationResult, linkWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, Shield, X } from 'lucide-react';
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

const countryFlag = (country: CountryCode) => String.fromCodePoint(
  ...country.split('').map((letter) => 127397 + letter.charCodeAt(0))
);

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
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-[#01040b]/90 p-3 backdrop-blur-[5px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="phone-verification-title">
      <div className="relative max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[34rem] overflow-y-auto overscroll-contain rounded-[22px] border border-blue-500/80 bg-[radial-gradient(circle_at_50%_13%,rgba(13,67,150,0.22),transparent_31%),linear-gradient(145deg,#07101f_0%,#020711_62%,#030914_100%)] px-5 pb-6 pt-5 shadow-[0_0_30px_rgba(20,102,255,0.24),inset_0_0_35px_rgba(15,70,160,0.08)] sm:px-10 sm:pb-8 sm:pt-7">
        <button type="button" onClick={close} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-600/70 bg-[#07101d]/80 text-white transition hover:border-blue-400 hover:bg-blue-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:right-4 sm:top-4" aria-label="Close phone verification"><X className="h-6 w-6" /></button>

        <div className="mx-auto flex max-w-md flex-col items-center pt-11 text-center sm:pt-3">
          <h2 id="phone-verification-title" className="text-[clamp(1.75rem,7vw,2.45rem)] font-black italic uppercase leading-none tracking-[-0.04em] text-white">Verify your <span className="text-blue-500">phone</span></h2>
          <p className="mt-3 max-w-[27rem] text-sm leading-6 text-slate-300 sm:text-base">Enter your phone number and we'll send you a 6-digit code to verify your account.</p>
        </div>

        <div className="mt-6 space-y-4 sm:mt-7">
          {!confirmation ? <>
            <label htmlFor="verification-phone" className="block text-sm font-bold uppercase tracking-wide text-white">Phone number</label>
            <div className="flex min-h-16 overflow-hidden rounded-xl border border-blue-600/70 bg-[#030a17] shadow-[inset_0_0_14px_rgba(16,65,150,0.12)] focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-blue-500/25">
              <label className="relative flex w-[8.6rem] shrink-0 border-r border-slate-700/80 sm:w-[9.75rem]"><span className="sr-only">Country code</span><select aria-label="Country code" value={country} onChange={(event) => setCountry(event.target.value as CountryCode)} className="h-full w-full appearance-none bg-transparent px-3 pr-8 text-base font-semibold text-white outline-none sm:px-4">
                {COUNTRY_OPTIONS.map((option) => <option className="bg-slate-950" key={option.country} value={option.country}>{countryFlag(option.country)} {option.callingCode} — {option.name}</option>)}
              </select></label>
              <Input id="verification-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={nationalNumber} onChange={(event) => setNationalNumber(event.target.value)} className="min-w-0 flex-1 !rounded-none !border-0 !bg-transparent px-4 text-base !ring-0 sm:text-lg" placeholder="(555) 123-4567" />
            </div>
            <div className="flex items-center gap-3 py-1 text-sm leading-5 text-slate-300"><span className="grid h-10 w-10 shrink-0 place-items-center text-blue-500"><Shield className="absolute h-9 w-9" /><LockKeyhole className="relative h-4 w-4" /></span><span>Your number will only be used for verification and account security.</span></div>
            <button type="button" onClick={sendCode} disabled={loading} className="flex min-h-16 w-full items-center justify-center rounded-xl border border-cyan-300/80 bg-gradient-to-b from-blue-500 to-blue-700 px-5 text-lg font-black uppercase tracking-wide text-white shadow-[0_0_17px_rgba(0,105,255,0.45),inset_0_1px_10px_rgba(66,184,255,0.45)] transition hover:brightness-110 disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span className="flex-1 text-center">Send code</span><ArrowRight className="h-6 w-6" /></>}</button>
          </> : <>
            <label htmlFor="verification-code" className="block text-xs font-semibold text-neutral-300">6-digit verification code</label>
            <Input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="min-h-14 text-center text-xl font-bold tracking-[0.35em]" placeholder="000000" />
            <button type="button" onClick={verifyCode} disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#205DD7] px-4 font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Verify phone</button>
            <button type="button" onClick={() => { setConfirmation(null); setCode(''); setMessage(null); }} className="min-h-11 w-full text-sm font-semibold text-blue-300">Use a different number</button>
          </>}
          {message && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-5 text-neutral-200" aria-live="polite">{message}</p>}
          <div id="phone-verification-recaptcha" />
        </div>
        {!confirmation && <p className="mt-5 text-center text-xs leading-5 text-slate-400 sm:text-sm">By continuing, you agree to our <a href="/terms" className="text-blue-500 hover:text-blue-400 hover:underline">Terms of Service</a><br className="sm:hidden" /> and <a href="/privacy" className="text-blue-500 hover:text-blue-400 hover:underline">Privacy Policy</a>.</p>}
      </div>
    </div>
  );
};
