import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import popupArt from '../assets/popup.png';
import pullzLogo from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';

type PromoPopupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
};

export const PromoPopupModal: React.FC<PromoPopupModalProps> = ({ isOpen, onClose, onSignUp, onSignIn }) => {
  const { stripeSettings } = useGame();
  const popupImage = stripeSettings.boxCatalogHeroImageUrl || stripeSettings.authPopupImageUrl || popupArt;
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center sm:py-8 sm:px-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-label="Close promotion"
        onClick={onClose}
      />
      <div
        className="relative my-auto w-full max-w-[540px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-popup-title"
      >
        <div className="relative overflow-visible rounded-[28px] border border-white/10 bg-gradient-to-br from-[#111a3a] via-[#0b1020] to-[#050811] shadow-[0_28px_70px_rgba(5,8,17,0.75)]">
          <div className="absolute left-1/2 top-[-80px] h-44 w-44 -translate-x-1/2 rounded-full bg-blue-500/35 blur-3xl sm:top-[-100px]" />
          <div className="pointer-events-none absolute left-1/2 top-[-110px] z-30 w-[230px] -translate-x-1/2 sm:top-[-140px] sm:w-[280px]">
            <img src={popupImage} alt="Mystery box promotion" className="aspect-square h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(20,10,60,0.45)]" loading="lazy" decoding="async" width={560} height={560} style={{ aspectRatio: "1 / 1" }} />
          </div>

          <div className="relative z-20 overflow-hidden rounded-[24px] bg-gradient-to-b from-[#101a34] via-[#0b1020] to-[#050811] px-6 pb-8 pt-20 sm:px-10 sm:pb-10 sm:pt-24">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-transparent via-[#0b1020]/70 to-[#0b1020]" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-gray-200 transition hover:border-white/30 hover:text-white"
              aria-label="Close promotion"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative z-10 text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <img src={pullzLogo} alt="Pullz.gg logo" className="h-7 w-7 rounded-full border border-white/10 bg-black/30 p-1" loading="lazy" decoding="async" width={64} height={64} style={{ aspectRatio: "1 / 1" }} />
                <span className="text-base font-semibold text-white">Pullz.gg</span>
              </div>
              <h2 id="promo-popup-title" className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                Get your <span className="text-cyan-300">free</span> box!
              </h2>
              <p className="mt-3 text-sm text-gray-300 sm:text-base">Sign up now to claim a free box.</p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onSignUp}
                  className="w-full rounded-full bg-gradient-to-r from-[#205DD7] to-sky-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(32,93,215,0.38)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  Sign Up &amp; Claim
                </button>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-sm font-medium text-gray-300 transition hover:text-white"
                >
                  Already have an account? <span className="text-cyan-300">Sign in</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
