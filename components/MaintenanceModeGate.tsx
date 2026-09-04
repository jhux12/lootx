import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, LockKeyhole, Wrench } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { getAuthErrorMessage } from '../utils/authErrors';

const MaintenanceScreen = () => {
  const { authInitialized, isAuthenticated, login, setView } = useGame();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);

  const handleAdminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setLoginError(null);
    setLoginAttempted(true);
    setView({ type: 'ADMIN' });

    try {
      await login(email, password, true);
    } catch (error) {
      setLoginError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showUnauthorizedMessage = loginAttempted
    && authInitialized
    && isAuthenticated
    && !isSubmitting
    && !loginError;

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#07090d] px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.13),transparent_42%)]" />
      <section className="relative w-full max-w-lg text-center" aria-live="polite">
        <div className="mx-auto mb-7 grid h-16 w-16 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 shadow-[0_20px_70px_rgba(239,68,68,0.12)]">
          <Wrench className="h-7 w-7 text-red-300" aria-hidden="true" />
        </div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-red-300">Pullz.gg</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Site under maintenance</h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-400 sm:text-base">
          We’re making a few improvements. Please check back soon.
        </p>

        {!showAdminLogin ? (
          <button
            type="button"
            onClick={() => setShowAdminLogin(true)}
            className="mx-auto mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-slate-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-white"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Admin sign in
          </button>
        ) : (
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-[#0d1118]/95 p-5 text-left shadow-2xl sm:p-6">
            <button
              type="button"
              onClick={() => {
                setShowAdminLogin(false);
                setLoginError(null);
              }}
              className="mb-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to maintenance notice
            </button>
            <h2 className="text-xl font-black text-white">Administrator access</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Sign in with an account that has administrator permissions.</p>
            <form className="mt-5 space-y-4" onSubmit={handleAdminLogin}>
              <label className="block text-xs font-bold text-slate-300">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/15"
                  placeholder="admin@example.com"
                  required
                  autoFocus
                />
              </label>
              <label className="block text-xs font-bold text-slate-300">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/15"
                  placeholder="Enter your password"
                  required
                />
              </label>
              {(loginError || showUnauthorizedMessage) && (
                <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200" role="alert">
                  {loginError ?? 'This account does not have administrator access.'}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Verifying access…' : 'Open admin panel'}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
};

export const MaintenanceModeGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { view, authInitialized, user } = useGame();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean | null>(null);

  useEffect(() => onSnapshot(
    doc(db, 'site', 'maintenance'),
    (snapshot) => setMaintenanceEnabled(snapshot.exists() && snapshot.data()?.enabled === true),
    (error) => {
      console.error('Maintenance status could not be loaded', error);
      // Fail open so a temporary status-read failure cannot lock administrators out.
      setMaintenanceEnabled(false);
    }
  ), []);

  if (maintenanceEnabled === null) {
    return <div className="min-h-[100dvh] bg-[#07090d]" aria-busy="true" aria-label="Loading site status" />;
  }

  const isAdminView = view.type === 'ADMIN'
    || view.type === 'ADMIN_UPGRADER_SETTINGS'
    || view.type === 'ADMIN_UPGRADER_TARGETS';
  const canAccessAdmin = isAdminView && authInitialized && user.isAdmin === true;

  if (maintenanceEnabled && !canAccessAdmin) return <MaintenanceScreen />;
  return <>{children}</>;
};

export default MaintenanceModeGate;
