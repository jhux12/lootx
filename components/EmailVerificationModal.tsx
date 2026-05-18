import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BrandLockup } from './BrandLockup';

export const EmailVerificationModal: React.FC = () => {
  const {
    resendEmailVerification,
    refreshEmailVerification,
    dismissEmailVerificationModal,
    emailVerificationStatus
  } = useGame();
  const { playSound } = useSound();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeModal = async () => {
    playSound('click');
    await dismissEmailVerificationModal();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    setMessage(null);
    playSound('click');

    try {
      await resendEmailVerification();
      setMessage('Verification email sent. Check your inbox.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    playSound('click');

    try {
      await refreshEmailVerification();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to refresh verification status.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isChecking = emailVerificationStatus === 'checking';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-[4px] transition-opacity duration-200 animate-in fade-in"
        aria-label="Close verification modal"
        onClick={closeModal}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/12 bg-slate-950/72 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.6)] backdrop-blur-2xl sm:max-h-[calc(100vh-2rem)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(32,93,215,0.14),_transparent_42%)]" />

        <button
          onClick={closeModal}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:right-4 sm:top-4"
          aria-label="Close verification modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <BrandLockup
                className="gap-2.5 sm:gap-3"
                logoClassName="h-10 w-auto sm:h-12"
                textClassName="text-lg sm:text-xl"
                dotClassName="text-xs sm:text-sm"
                showTextOnMobile
              />
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white sm:text-[2rem]">Verify your email</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300 sm:text-[15px]">
            We sent a verification link to your inbox. Confirm your email to unlock full access.
          </p>
        </div>

        <div className="relative mt-6 space-y-3 sm:mt-7">
          {isChecking && (
            <div className="flex items-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Verification successful — signing you in...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <AlertCircle className="h-4 w-4 shrink-0" /> {message}
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isChecking}
            className="btn-logo-gradient flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshing ? 'Checking...' : 'I verified my email'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || isChecking}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base font-semibold text-slate-100 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {isResending ? 'Resending...' : 'Resend verification email'}
          </button>
        </div>
      </div>
    </div>
  );
};
