import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, LogIn, UserCircle2 } from 'lucide-react';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../firebase';
import { BrandLockup } from './BrandLockup';
import { useGame } from '../context/GameContext';

const REDIRECT_DELAY_MS = 2500;

type VerificationState = 'loading' | 'success' | 'error';

export const VerifyEmailPage: React.FC = () => {
  const { openAuthModal, setView } = useGame();

  const navigateHome = useCallback(() => {
    window.history.replaceState({}, '', '/');
    setView({ type: 'HOME' });
  }, [setView]);

  const clearVerificationParams = useCallback(() => {
    window.history.replaceState({}, '', '/verify');
  }, []);
  const [status, setStatus] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Confirming your email now...');

  const verificationParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { mode: '', oobCode: '' };
    }

    const url = new URL(window.location.href);
    return {
      mode: url.searchParams.get('mode') || '',
      oobCode: url.searchParams.get('oobCode') || ''
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let redirectTimer: number | null = null;

    const finalizeVerification = async () => {
      const { mode, oobCode } = verificationParams;
      if (mode !== 'verifyEmail' || !oobCode) {
        if (!isMounted) return;
        setStatus('error');
        setMessage('This verification link is missing required details. Please request a new one.');
        return;
      }

      try {
        await applyActionCode(auth, oobCode);

        if (auth.currentUser) {
          await auth.currentUser.reload();
        }

        clearVerificationParams();

        if (!isMounted) return;
        setStatus('success');
        setMessage(auth.currentUser
          ? 'Your email is verified. You can now request shipment. Redirecting you to your profile...'
          : 'Your email is verified. You can sign in now. Redirecting you home...');

        redirectTimer = window.setTimeout(() => {
          if (auth.currentUser) {
            setView({ type: 'PROFILE' });
            return;
          }
          navigateHome();
        }, REDIRECT_DELAY_MS);
      } catch (error) {
        console.error('Failed to verify email with action code', error);
        clearVerificationParams();
        if (!isMounted) return;
        setStatus('error');
        setMessage('This verification link is invalid or has expired. Please request a new verification email.');
      }
    };

    void finalizeVerification();

    return () => {
      isMounted = false;
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [clearVerificationParams, navigateHome, setView, verificationParams]);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <section className="w-full rounded-3xl border border-white/10 bg-[#0b0f19] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8 md:p-10">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <BrandLockup
            className="justify-center"
            logoClassName="h-14 sm:h-16"
            textClassName="text-xl sm:text-2xl"
            showTextOnMobile
          />

          <div className={`mt-6 flex h-16 w-16 items-center justify-center rounded-full border text-white sm:h-20 sm:w-20 ${
            isLoading
              ? 'border-blue-400/40 bg-blue-500/10'
              : isSuccess
                ? 'border-emerald-400/40 bg-emerald-500/10'
                : 'border-red-400/40 bg-red-500/10'
          }`}>
            {isLoading && <LoaderCircle className="h-8 w-8 animate-spin text-blue-300 sm:h-10 sm:w-10" />}
            {isSuccess && <CheckCircle2 className="h-8 w-8 text-emerald-300 sm:h-10 sm:w-10" />}
            {!isLoading && !isSuccess && <AlertCircle className="h-8 w-8 text-red-300 sm:h-10 sm:w-10" />}
          </div>

          <h1 className="mt-6 text-2xl font-black text-white sm:text-3xl">
            {isLoading ? 'Verifying your email' : isSuccess ? 'Email verified' : 'Verification failed'}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-gray-300 sm:text-base">
            {message}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            {isSuccess ? (
              auth.currentUser ? (
                <button
                  type="button"
                  onClick={() => setView({ type: 'PROFILE' })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white btn-logo-gradient sm:w-auto"
                >
                  <UserCircle2 className="h-4 w-4" />
                  Go to profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    navigateHome();
                    openAuthModal('login');
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white btn-logo-gradient sm:w-auto"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </button>
              )
            ) : null}

            {!isLoading && (
              <button
                type="button"
                onClick={navigateHome}
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-100 transition hover:bg-white/10 sm:w-auto"
              >
                Back to home
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
