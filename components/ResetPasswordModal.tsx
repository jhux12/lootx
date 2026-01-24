import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Lock, X } from 'lucide-react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase';
import { BrandLockup } from './BrandLockup';

const clearResetParams = () => {
  const { pathname, hash } = window.location;
  window.history.replaceState({}, '', `${pathname}${hash}`);
};

export const ResetPasswordModal: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const isActive = mode === 'resetPassword' && !!oobCode;

  const [isOpen, setIsOpen] = useState(isActive);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isActive || !oobCode) return;
    verifyPasswordResetCode(auth, oobCode)
      .then((resolvedEmail) => setEmail(resolvedEmail))
      .catch(() => setError('This reset link is invalid or expired. Please request a new one.'));
  }, [isActive, oobCode]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsOpen(false);
    clearResetParams();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!oobCode) return;
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Use at least 6 characters for your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setMessage('Password updated! You can sign in with your new password.');
      setPassword('');
      setConfirmPassword('');
      clearResetParams();
    } catch (err) {
      setError('Unable to reset password. Please request a new reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <BrandLockup className="h-6" />
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-gray-300 hover:bg-white/10"
            aria-label="Close reset password"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-6">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Password reset
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-white">Choose a new password</h2>
          <p className="mt-2 text-sm text-slate-300">
            {email ? `Resetting the password for ${email}.` : 'Reset your password to regain access.'}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">
                New password
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">
                Confirm password
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
