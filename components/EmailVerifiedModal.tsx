import React from 'react';
import { CheckCircle2, LogIn, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BrandLockup } from './BrandLockup';

export const EmailVerifiedModal: React.FC = () => {
  const { openAuthModal, setShowEmailVerifiedModal } = useGame();
  const { playSound } = useSound();

  const handleSignIn = () => {
    playSound('click');
    setShowEmailVerifiedModal(false);
    openAuthModal('login');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" />

      <div className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95">
        <button
          onClick={() => setShowEmailVerifiedModal(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          aria-label="Close verification modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-5">
            <BrandLockup
              className="justify-center"
              logoClassName="h-12 md:h-14"
              textClassName="text-xl"
              showTextOnMobile
            />
          </div>
          <div className="flex items-center justify-center gap-2 text-emerald-300 text-sm font-semibold uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            Email verified
          </div>
          <h2 className="text-2xl font-black text-white mt-3">Email verified — please sign in</h2>
          <p className="text-gray-500 text-sm mt-2">
            Verification successful — please sign in to continue to Pullz.gg.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          className="w-full text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
        >
          <LogIn className="w-4 h-4" />
          Sign in
        </button>
      </div>
    </div>
  );
};
