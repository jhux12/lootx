import React, { useEffect } from 'react';
import { CheckCircle2, LogIn, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BrandLockup } from './BrandLockup';

export const EmailVerifiedModal: React.FC = () => {
  const { openAuthModal, setShowEmailVerifiedModal } = useGame();
  const { playSound } = useSound();

  const closeModal = () => {
    playSound('click');
    setShowEmailVerifiedModal(false);
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

  const handleSignIn = () => {
    playSound('click');
    setShowEmailVerifiedModal(false);
    openAuthModal('login');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-[4px] transition-opacity duration-200 animate-in fade-in"
        aria-label="Close verification modal"
        onClick={closeModal}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/12 bg-slate-950/72 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.6)] backdrop-blur-2xl sm:max-h-[calc(100vh-2rem)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.16),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.14),_transparent_45%)]" />

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

          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 sm:text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Email verified
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-[2rem]">Email verified — please sign in</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300 sm:text-[15px]">
            Verification successful — please sign in to continue to Pullz.gg.
          </p>
        </div>

        <div className="relative mt-6 sm:mt-7">
          <button
            type="button"
            onClick={handleSignIn}
            className="btn-logo-gradient flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98]"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
