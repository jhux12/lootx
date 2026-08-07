import React, { useEffect, useRef, useState } from 'react';
import { ConfirmationResult, linkWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import { auth, db } from '../firebase';
import { useGame } from '../context/GameContext';
import { Input } from './ui/Input';
import { PHONE_VERIFICATION_REQUEST_EVENT } from '../utils/phoneVerification';
import { lockPageScroll } from '../utils/scrollLock';
import { getPhoneAuthErrorCode, getPhoneAuthErrorMessage } from '../utils/phoneAuthErrors';

type VerificationReason = 'free_box' | 'daily_spin';

export const PhoneVerificationModal: React.FC = () => {
  const { user } = useGame();
  const [reason, setReason] = useState<VerificationReason | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? '');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: VerificationReason }>).detail;
      setReason(detail?.reason === 'daily_spin' ? 'daily_spin' : 'free_box');
      setPhoneNumber(user.phoneNumber ?? '');
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
    const normalized = phoneNumber.trim().replace(/[\s().-]/g, '');
    if (!/^\+[0-9]{7,15}$/.test(normalized)) {
      setMessage('Enter your phone in international format, including the + and country code.');
      return;
    }
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
      await result.user.getIdToken(true);
      await updateDoc(doc(db, 'users', result.user.uid), { phoneNumber });
      setMessage('Phone verified. You can now claim your free reward.');
      window.setTimeout(close, 900);
    } catch {
      setMessage('That code is incorrect or expired. Please try again.');
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
            <div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><Input id="verification-phone" type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="min-h-12 pl-10" placeholder="+1 555 123 4567" /></div>
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
