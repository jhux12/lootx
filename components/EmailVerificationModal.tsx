import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BrandLockup } from './BrandLockup';

export const EmailVerificationModal: React.FC = () => {
  const {
    resendEmailVerification,
    refreshEmailVerification,
    setShowEmailVerificationModal,
    emailVerificationStatus
  } = useGame();
  const { playSound } = useSound();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      playSound('error');
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
      playSound('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isChecking = emailVerificationStatus === 'checking';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" />

      <div className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95">
        <button
          onClick={() => setShowEmailVerificationModal(false)}
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
          <h2 className="text-2xl font-black text-white mb-2">Verify your email</h2>
          <p className="text-gray-500 text-sm">
            We sent a verification link to your inbox. Confirm your email to unlock full access.
          </p>
        </div>

        {isChecking && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2 text-blue-300 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Verification successful — signing you in...
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-300 text-sm">
            <AlertCircle className="w-4 h-4" /> {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isChecking}
            className="w-full text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
          >
            {isRefreshing ? 'Checking...' : 'I verified my email'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || isChecking}
            className="w-full text-gray-200 font-semibold py-3 rounded-lg border border-gray-700 bg-[#111827] hover:bg-[#1f2937] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
            {isResending ? 'Resending...' : 'Resend verification email'}
          </button>
        </div>
      </div>
    </div>
  );
};
