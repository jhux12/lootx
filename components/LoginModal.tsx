import React, { useEffect, useState } from 'react';
import { X, Mail, Lock, User, Loader2, MailCheck } from 'lucide-react';
import { AuthCredential } from 'firebase/auth';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import googleLogo from '../assets/google-logo.svg';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { getAuthErrorMessage } from '../utils/authErrors';
import { toast } from '../src/ui/toast/toast';
import { DEFAULT_POST_SIGNUP_REDIRECT, setPostSignupRedirect } from '../utils/postSignupRedirect';
import { lockPageScroll } from '../utils/scrollLock';
import { trackEvent as trackGaEvent } from '../services/analytics';

const AUTH_INLINE_MESSAGE_KEY = 'authInlineMessage';
const EMAIL_CONFIRMATION_MESSAGE = 'Account ready. We sent a verification email for when you are ready to ship items.';

export const LoginModal: React.FC = () => {
  const { login, loginWithGoogle, linkGoogleAccount, register, resetPassword, setShowLoginModal, authModalMode, setAuthModalMode, stripeSettings } = useGame();
  const { playSound } = useSound();
  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);
  const fallbackRegisterBonusImage = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/boxes%2Fu%20(4).png?alt=media&token=2bb02e25-aad4-45b7-b406-46a189ee6f34';
  const registerBonusImage = stripeSettings.boxCatalogHeroImageUrl || fallbackRegisterBonusImage;

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [googleLinkEmail, setGoogleLinkEmail] = useState('');
  const [googleLinkPassword, setGoogleLinkPassword] = useState('');
  const [googleLinkCredential, setGoogleLinkCredential] = useState<AuthCredential | null>(null);
  const [signupConsent, setSignupConsent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedMessage = window.sessionStorage.getItem(AUTH_INLINE_MESSAGE_KEY);
    if (storedMessage) {
      window.sessionStorage.removeItem(AUTH_INLINE_MESSAGE_KEY);
    }
    return storedMessage;
  });
  const [showGoogleRequirementsTooltip, setShowGoogleRequirementsTooltip] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showOAuthFallback, setShowOAuthFallback] = useState(false);
  const [showEmailFields, setShowEmailFields] = useState(false);
  const [emailConfirmationSentTo, setEmailConfirmationSentTo] = useState<string | null>(null);
  const [emailConfirmationReminderCount, setEmailConfirmationReminderCount] = useState(0);
  const isLinkingGoogle = Boolean(googleLinkCredential);
  const normalizedEmail = email.trim().toLowerCase();
  const isEmailConfirmationMessage = message === EMAIL_CONFIRMATION_MESSAGE;
  const showEmailConfirmationNotice = Boolean(isEmailConfirmationMessage && emailConfirmationSentTo && normalizedEmail === emailConfirmationSentTo && mode === 'register' && showEmailFields && !isLinkingGoogle);
  const showRegisterFormMessage = Boolean(message && mode === 'register' && showEmailFields && !isLinkingGoogle && !showEmailConfirmationNotice);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('click');

    if (mode === 'register' && emailConfirmationSentTo && normalizedEmail === emailConfirmationSentTo) {
      setUserError(null);
      setMessage(EMAIL_CONFIRMATION_MESSAGE);
      setEmailConfirmationReminderCount((count) => count + 1);
      return;
    }

    setIsLoading(true);
    setUserError(null);
    setMessage(null);

    try {
      if (mode === 'register') {
        trackGaEvent('sign_up_start', { method: 'email', location: 'auth_modal' }, 'email_auth_modal');
        setPostSignupRedirect(DEFAULT_POST_SIGNUP_REDIRECT);
        if (!signupConsent) {
          setUserError('Please confirm the checkbox to continue with email registration.');
          setIsLoading(false);
          return;
        }
        const result = await register(username, email, password);
        if (result?.requiresEmailVerification) {
          setShowEmailFields(true);
          setEmailConfirmationSentTo(normalizedEmail);
          setEmailConfirmationReminderCount((count) => count + 1);
          setPassword('');
          setMessage(EMAIL_CONFIRMATION_MESSAGE);
          return;
        }
      } else {
        const result = await login(email, password, rememberMe);
        if (result?.requiresEmailVerification) {
          setEmailConfirmationSentTo(normalizedEmail);
          setEmailConfirmationReminderCount((count) => count + 1);
          setPassword('');
          setMessage(EMAIL_CONFIRMATION_MESSAGE);
          return;
        }
      }
      // Success - modal closes inside context functions
    } catch (err: any) {
      console.error(err);
      setMessage(null);
      setEmailConfirmationSentTo(null);
      setUserError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('Google button clicked');
    if (isOAuthLoading || isLoading) {
      return;
    }

    if (mode === 'register' && !signupConsent) {
      setShowGoogleRequirementsTooltip(true);
      return;
    }

    setShowOAuthFallback(false);
    setIsLoading(true);
    setIsOAuthLoading(true);
    setUserError(null);
    setMessage('Opening Google sign-in…');
    playSound('click');

    try {
      if (mode === 'register') {
        setPostSignupRedirect(DEFAULT_POST_SIGNUP_REDIRECT);
      }
      const result = await loginWithGoogle({ remember: rememberMe, isRetry: false, useRedirect: false });
      if (result.status === 'redirect-started') {
        setMessage('Opening Google sign-in…');
        return;
      }
      if (result.status === 'link-required') {
        setGoogleLinkEmail(result.email);
        setGoogleLinkCredential(result.credential);
        setGoogleLinkPassword('');
        setMessage('Enter your password to link your Google account.');
        return;
      }

      if (result.status === 'error') {
        setUserError(getAuthErrorMessage(result.message));
        setMessage('Having trouble? Please try again or use email sign-up.');
      }
    } catch (err: any) {
      console.error(err);
      setUserError(getAuthErrorMessage(err));
      setMessage('Having trouble? Please try again or use email sign-up.');
    } finally {
      setIsLoading(false);
      setIsOAuthLoading(false);
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
    setShowEmailFields(false);
    setShowOAuthFallback(false);
    setEmailConfirmationSentTo(null);
    setEmailConfirmationReminderCount(0);
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
    setShowOAuthFallback(false);
    setEmailConfirmationSentTo(null);
    setEmailConfirmationReminderCount(0);
  };

  useEffect(() => {
    if (userError) {
      toast.error(userError);
    }
  }, [userError]);

  useEffect(() => {
    if (!message || message === EMAIL_CONFIRMATION_MESSAGE) return;
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
    if (mode === 'register' && signupConsent) {
      setShowGoogleRequirementsTooltip(false);
    }
  }, [mode, signupConsent]);

  useEffect(() => {
    if (!isOAuthLoading) {
      setShowOAuthFallback(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowOAuthFallback(true);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [isOAuthLoading]);

  const remindEmailConfirmation = () => {
    setUserError(null);
    setMessage(EMAIL_CONFIRMATION_MESSAGE);
    setEmailConfirmationReminderCount((count) => count + 1);
  };

  useEffect(() => lockPageScroll({ preserveScrollPosition: true }), []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return undefined;

    const previousContent = viewport.getAttribute('content');
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content');

    return () => {
      if (previousContent) {
        viewport.setAttribute('content', previousContent);
      }
    };
  }, []);

  return (
    <div
      className="bet-auth-modal fixed inset-0 z-[300] flex touch-pan-y touch-manipulation items-start justify-center overflow-y-auto overscroll-contain p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:overflow-hidden sm:p-4"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => setShowLoginModal(false)}
      />

      <div className="pullz-stable-modal relative my-auto flex max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#18181b] shadow-2xl sm:max-h-[95dvh]">
        <button
          onClick={() => setShowLoginModal(false)}
          className="absolute right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex w-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#18181b] p-4 pr-3 sm:p-6 sm:pr-5">
          {!isLinkingGoogle && (
            <div className="mb-5 flex w-full rounded-xl border border-white/5 bg-[#18181b] p-1">
              <button
                onClick={() => mode !== 'login' && toggleMode()}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${mode === 'login' ? 'bg-[#27272a] text-white shadow-sm ring-1 ring-white/5' : 'text-neutral-500 hover:text-neutral-300'}`}
                type="button"
              >
                Login
              </button>
              <button
                onClick={() => mode !== 'register' && toggleMode()}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${mode === 'register' ? 'bg-[#205DD7] text-white shadow-md shadow-blue-900/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                type="button"
              >
                Register
              </button>
            </div>
          )}

          <div className="mb-4 text-left">
            <h2 className="text-2xl font-black text-white">
              {isLinkingGoogle ? 'Link Google Account' : mode === 'login' ? 'Welcome Back' : 'Register'}
            </h2>
            {(isLinkingGoogle || mode === 'login') && (
              <p className="mt-1 text-sm text-neutral-500">
                {isLinkingGoogle
                  ? 'Confirm your password to link Google with your existing account.'
                  : 'Login to access your account.'}
              </p>
            )}
            {message && !showRegisterFormMessage && !showEmailConfirmationNotice && (
              <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-neutral-300" aria-live="polite">
                {message}
              </p>
            )}
          </div>

          {mode === 'register' && !isLinkingGoogle && !showEmailFields && (
            <div className="relative mb-3 mt-6 overflow-visible rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] via-[#18181b] to-[#101014] px-4 pb-3 pt-10 text-center sm:mt-8 sm:pt-12">
              <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-24 w-[min(70vw,210px)] -translate-x-1/2 -translate-y-1/2 sm:h-28 sm:w-[240px]">
                <img
                  src={registerBonusImage}
                  alt="Free signup box"
                  className="h-full w-full object-contain"
                  loading="eager"
                  decoding="async"
                  width={320}
                  height={176}
                  style={{ aspectRatio: '20 / 11' }}
                />
              </div>
              <p className="text-sm text-neutral-300">Create your account to open your free box.</p>
            </div>
          )}

          {!isLinkingGoogle && (
            <>
              {mode === 'register' && (
                <label className="group mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#141417] p-3 text-xs leading-5">
                  <Checkbox
                    required
                    checked={signupConsent}
                    onChange={(e) => setSignupConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="select-none text-neutral-400 group-hover:text-neutral-300">
                    I agree to the <a href="#" className="text-blue-400 hover:text-blue-300 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-400 hover:text-blue-300 hover:underline">Privacy Policy</a>, and confirm I am 18+.
                  </span>
                </label>
              )}
              {!showEmailFields && <>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || (mode === 'register' && !signupConsent)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#18181b] py-3 text-sm font-medium text-white transition-colors hover:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isOAuthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <img src={googleLogo} alt="Google" className="h-5 w-5" width={20} height={20} style={{ aspectRatio: '1 / 1' }} />}
                  {isOAuthLoading ? 'Opening Google sign-in…' : 'Continue with Google'}
                </button>

                {mode === 'register' && showGoogleRequirementsTooltip && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
                    Check the consent box to continue.
                  </div>
                )}

                {showOAuthFallback && (
                  <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                    <p className="font-semibold">Having trouble?</p>
                    <p className="mt-1 text-blue-100/90">Please retry Google sign-in or use email sign-up.</p>
                  </div>
                )}
              </div>

              <div className="relative py-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider">
                  <span className="bg-[#18181b] px-3 text-neutral-400">Or</span>
                </div>
              </div>
              </>}
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
                <label className="ml-1 text-xs font-semibold text-neutral-400">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="password"
                    value={googleLinkPassword}
                    onChange={(e) => setGoogleLinkPassword(e.target.value)}
                    className="rounded-xl border-white/10 bg-[#18181b] py-3.5 pl-10 pr-4"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full rounded-xl bg-[#205DD7] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#1f6bea] hover:shadow-lg hover:shadow-blue-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
          ) : showEmailFields ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'register' && (
                <div className="flex flex-col gap-1.5">
                  <label className="ml-1 text-xs font-semibold text-neutral-400">Username</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="rounded-xl border-white/10 bg-[#18181b] py-3.5 pl-10 pr-4"
                      placeholder="Display Name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-semibold text-neutral-400">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl border-white/10 bg-[#18181b] py-3.5 pl-10 pr-4"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-semibold text-neutral-400">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl border-white/10 bg-[#18181b] py-3.5 pl-10 pr-4"
                    placeholder="Enter your password"
                    required
                  />
                </div>
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
                    className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {showEmailConfirmationNotice && (
                <div
                  key={emailConfirmationReminderCount}
                  className="rounded-2xl border border-emerald-300/40 bg-emerald-500/15 p-3 text-sm text-emerald-50 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-300/20 animate-in fade-in zoom-in-95 duration-200 sm:p-4"
                  aria-live="assertive"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-100">
                      <MailCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-black leading-6 text-white">Please check your email to confirm</p>
                      <p className="mt-1 leading-5 text-emerald-50/90">
                        We sent a confirmation link{email.trim() ? <> to <span className="break-all font-semibold text-white">{email.trim()}</span></> : null}. Tap that link before signing in or claiming your free box.
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Already clicked Register? This is your next step.</p>
                    </div>
                  </div>
                </div>
              )}

              {showRegisterFormMessage && (
                <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-neutral-300" aria-live="polite">
                  {message}
                </p>
              )}

              <button
                type={showEmailConfirmationNotice ? 'button' : 'submit'}
                onClick={showEmailConfirmationNotice ? remindEmailConfirmation : undefined}
                disabled={isLoading || (mode === 'register' && !signupConsent)}
                className="mt-2 w-full rounded-xl bg-[#205DD7] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#1f6bea] hover:shadow-lg hover:shadow-blue-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Please wait...' : showEmailConfirmationNotice ? 'Please check your email to confirm' : mode === 'login' ? 'Login with Password' : 'Register with Password'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowEmailFields(true);
                setUserError(null);
                setMessage(null);
                playSound('click');
              }}
              disabled={mode === 'register' && !signupConsent}
              className="w-full rounded-xl border border-white/10 bg-[#27272a] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#323237] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === 'login' ? 'Sign in with Email' : 'Continue with Email'}
            </button>
          )}

          {!isLinkingGoogle && (
            <div className="mt-auto pt-5 text-center text-xs text-neutral-500">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={toggleMode}
                className="ml-1 font-bold text-blue-400 hover:underline"
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
