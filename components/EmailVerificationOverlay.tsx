import React, { useEffect, useState } from 'react';
import { MailCheck, RefreshCcw, LogOut, Send } from 'lucide-react';
import { useGame } from '../context/GameContext';

const RESEND_COOLDOWN_SECONDS = 30;

export const EmailVerificationOverlay: React.FC = () => {
  const {
    requiresEmailVerification,
    verificationEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    logout
  } = useGame();
  const [cooldown, setCooldown] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!requiresEmailVerification) {
      setCooldown(0);
      setStatusMessage('');
      return;
    }
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown, requiresEmailVerification]);

  if (!requiresEmailVerification) return null;

  const handleResend = async () => {
    try {
      await resendVerificationEmail();
      setStatusMessage('Verification email sent. Please check your inbox.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      console.error('Failed to resend verification email', error);
      setStatusMessage('Unable to resend verification email right now.');
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshEmailVerification();
      setStatusMessage('Checking verification status...');
    } catch (error) {
      console.error('Failed to refresh verification status', error);
      setStatusMessage('Unable to refresh verification status.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050811]/90 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#0b0e14] p-6 shadow-2xl shadow-purple-500/10 sm:p-8">
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-3 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-200">
            <MailCheck className="h-4 w-4" />
            Verify your email
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">One more step to unlock Pullz.gg</h2>
            <p className="mt-2 text-sm text-gray-400">
              We sent a verification link to <span className="font-semibold text-gray-200">{verificationEmail || 'your email'}</span>.
              Please verify your email to access protected features.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 rounded-xl border border-gray-800 bg-[#111621] px-4 py-3 text-sm text-gray-300">
            {statusMessage}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-200 transition hover:border-purple-400 hover:text-purple-100"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh status
          </button>
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-[#111621] px-4 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
};
