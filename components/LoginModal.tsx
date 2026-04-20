import React, { useEffect, useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Gift } from 'lucide-react';
import { AuthCredential } from 'firebase/auth';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import googleLogo from '../assets/google-logo.svg';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { getAuthErrorMessage } from '../utils/authErrors';
import { toast } from '../src/ui/toast/toast';

export const LoginModal: React.FC = () => {
  const { login, loginWithGoogle, linkGoogleAccount, register, resetPassword, setShowLoginModal, authModalMode, setAuthModalMode } = useGame();
  const { playSound } = useSound();
  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);
  const registerBonusImage = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/boxes%2Fu%20(4).png?alt=media&token=2bb02e25-aad4-45b7-b406-46a189ee6f34';

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [googleLinkEmail, setGoogleLinkEmail] = useState('');
  const [googleLinkPassword, setGoogleLinkPassword] = useState('');
  const [googleLinkCredential, setGoogleLinkCredential] = useState<AuthCredential | null>(null);
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showGoogleRequirementsTooltip, setShowGoogleRequirementsTooltip] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGoogleLinkPassword, setShowGoogleLinkPassword] = useState(false);
  const isLinkingGoogle = Boolean(googleLinkCredential);
  const isRegisterMode = mode === 'register' && !isLinkingGoogle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setUserError(null);
    setMessage(null);
    playSound('click');

    try {
      if (mode === 'register') {
        if (!confirmAdult || !acceptTerms) {
          setUserError('Please confirm you are 18+ and accept the terms to continue.');
          setIsLoading(false);
          return;
        }
        await register(username, email, password);
      } else {
        await login(email, password, rememberMe);
      }
      // Success - modal closes inside context functions
    } catch (err: any) {
      console.error(err);
      setUserError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (mode === 'register' && (!confirmAdult || !acceptTerms)) {
      setShowGoogleRequirementsTooltip(true);
      return;
    }

    setIsLoading(true);
    setUserError(null);
    setMessage(null);
    playSound('click');

    try {
      const result = await loginWithGoogle(rememberMe);
      if (result.status === 'link-required') {
        setGoogleLinkEmail(result.email);
        setGoogleLinkCredential(result.credential);
        setGoogleLinkPassword('');
        setMessage('Enter your password to link your Google account.');
        return;
      }

      if (result.status === 'error') {
        setUserError(getAuthErrorMessage(result.message));
      }
    } catch (err: any) {
      console.error(err);
      setUserError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkGoogleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleLinkCredential) return;

    setIsLoading(true);
    setUserError(null);
    setMessage(null);
    playSound('click');

    try {
      const result = await linkGoogleAccount(googleLinkEmail, googleLinkPassword, googleLinkCredential);
      if (result.status === 'error') {
        setUserError(getAuthErrorMessage(result.message));
      }
    } catch (err: any) {
      console.error(err);
      setUserError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setUserError('Enter your email to receive a password reset link.');
      return;
    }

    setIsLoading(true);
    setUserError(null);
    setMessage(null);
    playSound('click');

    try {
      await resetPassword(email.trim());
      setMessage('Password reset link sent. Check your inbox.');
    } catch (err: any) {
      console.error(err);
      setUserError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(prev => {
      const nextMode = prev === 'login' ? 'register' : 'login';
      setAuthModalMode(nextMode);
      return nextMode;
    });
    setUserError(null);
    setMessage(null);
    setGoogleLinkEmail('');
    setGoogleLinkPassword('');
    setGoogleLinkCredential(null);
    setRememberMe(true);
    setShowPassword(false);
    setShowGoogleLinkPassword(false);
    playSound('click');
  };

  useEffect(() => {
    setMode(authModalMode);
  }, [authModalMode]);

  const clearGoogleLinkState = () => {
    setGoogleLinkEmail('');
    setGoogleLinkPassword('');
    setGoogleLinkCredential(null);
    setUserError(null);
    setMessage(null);
    setShowGoogleLinkPassword(false);
  };

  useEffect(() => {
    if (userError) {
      toast.error(userError);
    }
  }, [userError]);

  useEffect(() => {
    if (!message) return;
    const normalized = message.toLowerCase();
    if (/(success|sent|saved|updated|completed|linked)/.test(normalized)) {
      toast.success(message);
      return;
    }
    toast.info(message);
  }, [message]);

  useEffect(() => {
    if (!showGoogleRequirementsTooltip) return;

    const timeoutId = window.setTimeout(() => {
      setShowGoogleRequirementsTooltip(false);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [showGoogleRequirementsTooltip]);

  useEffect(() => {
    if (mode === 'register' && acceptTerms && confirmAdult) {
      setShowGoogleRequirementsTooltip(false);
    }
  }, [mode, acceptTerms, confirmAdult]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div data-disable-pull-refresh="true" className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden overscroll-none p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => setShowLoginModal(false)}
      />

      <div className="relative flex max-h-[95dvh] w-full max-w-[34rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#070910] shadow-2xl">
        <button
          onClick={() => setShowLoginModal(false)}
          className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex w-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#070910] p-4 pr-3 sm:p-6 sm:pr-5">
          {!isLinkingGoogle && (
            <div className="mb-5 flex w-full rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                onClick={() => mode !== 'login' && toggleMode()}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${mode === 'login' ? 'bg-white/[0.06] text-white shadow-sm ring-1 ring-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}
                type="button"
              >
                Login
              </button>
              <button
                onClick={() => mode !== 'register' && toggleMode()}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${mode === 'register' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-900/30' : 'text-neutral-500 hover:text-neutral-300'}`}
                type="button"
              >
                Register
              </button>
            </div>
          )}

          <div className="mb-4 text-left">
            <h2 className="text-2xl font-black text-white">
              {isLinkingGoogle ? 'Link Google Account' : mode === 'login' ? 'Welcome Back' : 'Create your account'}
            </h2>
            {(isLinkingGoogle || mode === 'login' || isRegisterMode) && (
              <p className="mt-1 text-sm text-neutral-500">
                {isLinkingGoogle
                  ? 'Confirm your password to link Google with your existing account.'
                  : isRegisterMode
                    ? 'Join Pullz and start opening boxes.'
                    : 'Login to access your account.'}
              </p>
            )}
          </div>

          {isRegisterMode && (
            <div className="mb-4 rounded-2xl border border-indigo-400/35 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-300/40 bg-indigo-500/20 text-indigo-200">
                    <Gift className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-300">Free signup bonus</p>
                  <p className="mt-1 text-sm text-neutral-200">Register to claim your free box.</p>
                </div>
                <img
                  src={registerBonusImage}
                  alt="Free signup box"
                  className="mx-auto hidden h-20 w-auto shrink-0 object-contain sm:block sm:h-24"
                />
              </div>
            </div>
          )}

          {!isLinkingGoogle && (
            <>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <img src={googleLogo} alt="Google" className="h-5 w-5" />
                  Continue with Google
                </button>

                {mode === 'register' && showGoogleRequirementsTooltip && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
                    Check both boxes to continue with Google.
                  </div>
                )}
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider">
                  <span className="bg-[#070910] px-3 text-neutral-500">Or continue with email</span>
                </div>
              </div>
            </>
          )}

          {isLinkingGoogle ? (
            <form onSubmit={handleLinkGoogleAccount} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-semibold text-neutral-400">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="email"
                    value={googleLinkEmail}
                    readOnly
                    className="rounded-xl border-white/10 bg-[#18181b] py-3.5 pl-10 pr-4 text-white/60"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-semibold text-neutral-300">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type={showGoogleLinkPassword ? 'text' : 'password'}
                    value={googleLinkPassword}
                    onChange={(e) => setGoogleLinkPassword(e.target.value)}
                    className="rounded-xl border-white/10 bg-[#0a1222] py-3.5 pl-10 pr-12"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleLinkPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                    aria-label={showGoogleLinkPassword ? 'Hide password' : 'Show password'}
                  >
                    {showGoogleLinkPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Linking...' : 'Link Google'}
              </button>

              <button
                type="button"
                onClick={clearGoogleLinkState}
                className="text-center text-xs text-neutral-400 hover:text-neutral-200"
              >
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'register' && (
                <div className="flex flex-col gap-1.5">
                  <label className="ml-1 text-xs font-semibold text-neutral-300">Display Name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="rounded-xl border-white/10 bg-[#0a1222] py-3.5 pl-10 pr-4"
                      placeholder="Display Name"
                      required
                    />
                  </div>
                  <p className="ml-1 text-xs text-neutral-500">This will be your public name on Pullz.</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-semibold text-neutral-300">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl border-white/10 bg-[#0a1222] py-3.5 pl-10 pr-4"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-semibold text-neutral-300">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl border-white/10 bg-[#0a1222] py-3.5 pl-10 pr-12"
                    placeholder={isRegisterMode ? 'Create a password' : 'Enter your password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isRegisterMode && <p className="ml-1 text-xs text-neutral-500">Must be at least 8 characters.</p>}
              </div>

              {mode === 'login' && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 text-neutral-400">
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === 'register' && (
                <div className="mt-1 flex flex-col gap-3 text-xs">
                  <label className="group flex cursor-pointer items-start gap-3">
                    <Checkbox
                      required
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="select-none text-neutral-400 group-hover:text-neutral-300">
                      I agree to the <a href="#" className="text-indigo-400 hover:text-indigo-300 hover:underline">Terms of Service</a> and <a href="#" className="text-indigo-400 hover:text-indigo-300 hover:underline">Privacy Policy</a>
                    </span>
                  </label>

                  <label className="group flex cursor-pointer items-start gap-3">
                    <Checkbox
                      required
                      checked={confirmAdult}
                      onChange={(e) => setConfirmAdult(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="select-none text-neutral-400 group-hover:text-neutral-300">
                      I confirm I am 18 years of age or older
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-indigo-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Please wait...' : mode === 'login' ? 'Login with Password' : 'Create Account'}
              </button>
            </form>
          )}

          {!isLinkingGoogle && (
            <div className="mt-auto pt-5 text-center text-xs text-neutral-500">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={toggleMode}
                className="ml-1 font-bold text-indigo-400 hover:underline"
              >
                {mode === 'login' ? 'Register' : 'Login'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
