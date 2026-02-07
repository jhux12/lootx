import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import popupArt from '../assets/popup.png';

type PromoPopupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
};

export const PromoPopupModal: React.FC<PromoPopupModalProps> = ({ isOpen, onClose, onSignUp, onSignIn }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-label="Close promotion"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[520px] animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-popup-title"
      >
        <div className="relative overflow-visible rounded-[28px] border border-white/10 bg-gradient-to-br from-[#101734] via-[#0b1020] to-[#050811] shadow-[0_24px_60px_rgba(5,8,17,0.7)]">
          <div className="absolute left-1/2 top-[-90px] h-44 w-44 -translate-x-1/2 rounded-full bg-purple-500/40 blur-3xl" />
          <div className="absolute left-1/2 top-[-120px] z-10 w-[220px] -translate-x-1/2 sm:top-[-140px] sm:w-[260px]">
            <img src={popupArt} alt="Mystery box promotion" className="h-auto w-full" />
          </div>

          <div className="relative z-20 overflow-hidden rounded-[24px] bg-gradient-to-b from-[#0f1630] via-[#0b1020] to-[#050811] px-6 pb-8 pt-32 sm:px-10 sm:pb-10 sm:pt-36">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-transparent via-[#0b1020]/70 to-[#0b1020]" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-gray-200 transition hover:border-white/30 hover:text-white"
              aria-label="Close promotion"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative z-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300/80">Mystery Box Website</p>
              <h2 id="promo-popup-title" className="mt-3 text-3xl font-black text-white sm:text-4xl">
                Get your free box
              </h2>
              <p className="mt-3 text-sm text-gray-300 sm:text-base">Sign up now to claim a free box.</p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onSignUp}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(124,58,237,0.35)] transition hover:brightness-110"
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
