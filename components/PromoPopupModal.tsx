import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import popupArt from '../assets/popup.png';
import pullzLogo from '../assets/pullz-p.PNG';

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
        className="relative w-full max-w-[540px] animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-popup-title"
      >
        <div className="relative overflow-visible rounded-[28px] border border-white/10 bg-gradient-to-br from-[#111a3a] via-[#0b1020] to-[#050811] shadow-[0_28px_70px_rgba(5,8,17,0.75)]">
          <div className="absolute left-1/2 top-[-80px] h-44 w-44 -translate-x-1/2 rounded-full bg-purple-500/35 blur-3xl sm:top-[-100px]" />
          <div className="absolute left-1/2 top-[-110px] z-10 w-[230px] -translate-x-1/2 sm:top-[-140px] sm:w-[280px]">
            <img src={popupArt} alt="Mystery box promotion" className="h-auto w-full drop-shadow-[0_18px_30px_rgba(20,10,60,0.45)]" />
          </div>

          <div className="relative z-20 overflow-hidden rounded-[24px] bg-gradient-to-b from-[#101a34] via-[#0b1020] to-[#050811] px-6 pb-8 pt-24 sm:px-10 sm:pb-10 sm:pt-28">
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
              <div className="mb-4 flex items-center justify-center gap-2">
                <img src={pullzLogo} alt="Pullz.gg logo" className="h-7 w-7 rounded-full border border-white/10 bg-black/30 p-1" />
                <span className="text-base font-semibold text-white">Pullz.gg</span>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-purple-200/70">Mystery Box Website</p>
              <h2 id="promo-popup-title" className="mt-3 text-3xl font-black text-white sm:text-4xl">
                Get your free box
              </h2>
              <p className="mt-3 text-sm text-gray-300 sm:text-base">Sign up now to claim a free box.</p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onSignUp}
                  className="w-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(124,58,237,0.38)] transition hover:-translate-y-0.5 hover:brightness-110"
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
