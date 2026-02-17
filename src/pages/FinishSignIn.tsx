import React, { useEffect, useState } from 'react';
import { finishMagicLinkSignIn, sendMagicLink, EMAIL_RECOVERY_ERROR_MESSAGE } from '../lib/auth';

export const FinishSignIn: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(localStorage.getItem('lastLoginEmail') ?? '');
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await finishMagicLinkSignIn();
        window.history.replaceState({}, '', '/');
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to finish sign-in.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const normalizedEmail = email.trim().toLowerCase();

  const handleContinue = async () => {
    if (!normalizedEmail) {
      setError('Enter the email address you used to request the link.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await finishMagicLinkSignIn(normalizedEmail);
      window.history.replaceState({}, '', '/');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!normalizedEmail) {
      setError('Enter your email first so we can resend your sign-in link.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await sendMagicLink(normalizedEmail);
      setInfo('New link sent. Open in SAME browser/device you requested it from.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  const needsEmailRecovery = error === EMAIL_RECOVERY_ERROR_MESSAGE;

  return (
    <div className="min-h-screen bg-[#050811] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-cyan-500/20 bg-[#131720] p-5 shadow-[0_20px_60px_-30px_rgba(34,211,238,0.65)] sm:p-7">
        <h1 className="text-xl font-black sm:text-2xl">Finishing your sign-in</h1>
        <p className="mt-2 text-sm text-gray-400">We&apos;re securely verifying your email link.</p>

        {loading && <p className="mt-4 text-sm text-cyan-300">Please wait...</p>}

        {!loading && error && !needsEmailRecovery && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        )}

        {!loading && needsEmailRecovery && (
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
              Open this link in the same browser/device you requested it from OR enter your email to continue/resend.
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0f1420] px-3 py-2.5 text-sm text-white outline-none ring-cyan-400/50 focus:ring"
              placeholder="you@example.com"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleContinue}
                disabled={loading}
                className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50"
              >
                Resend
              </button>
            </div>
          </div>
        )}

        {!loading && info && <p className="mt-3 text-sm text-green-300">{info}</p>}
      </div>
    </div>
  );
};
