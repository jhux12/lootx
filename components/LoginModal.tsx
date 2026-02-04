import React, { useEffect, useState } from 'react';
import { X, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { AuthCredential } from 'firebase/auth';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BrandLockup } from './BrandLockup';
import googleLogo from '../assets/google-logo.svg';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';

export const LoginModal: React.FC = () => {
  const { login, loginWithGoogle, linkGoogleAccount, register, resetPassword, setShowLoginModal, authModalMode, setAuthModalMode } = useGame();
  const { playSound } = useSound();
  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);
  
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isLinkingGoogle = Boolean(googleLinkCredential);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    playSound('click');
    
    try {
        if (mode === 'register') {
            if (!confirmAdult || !acceptTerms) {
                setError('Please confirm you are 18+ and accept the terms to continue.');
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
        setError(err.message || 'Authentication failed');
        playSound('error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
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
        setError(result.message || 'Google sign-in failed.');
        playSound('error');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed');
      playSound('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkGoogleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleLinkCredential) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);
    playSound('click');

    try {
      const result = await linkGoogleAccount(googleLinkEmail, googleLinkPassword, googleLinkCredential);
      if (result.status === 'error') {
        setError(result.message || 'Unable to link Google account.');
        playSound('error');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to link Google account.');
      playSound('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
      if (!email.trim()) {
          setError('Enter your email to receive a password reset link.');
          return;
      }

      setIsLoading(true);
      setError(null);
      setMessage(null);
      playSound('click');

      try {
          await resetPassword(email.trim());
          setMessage('Password reset link sent. Check your inbox.');
      } catch (err: any) {
          console.error(err);
          setError(err.message || 'Unable to send reset email.');
          playSound('error');
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
      setError(null);
      setMessage(null);
      setGoogleLinkEmail('');
      setGoogleLinkPassword('');
      setGoogleLinkCredential(null);
      setRememberMe(true);
      playSound('click');
  };

  useEffect(() => {
    setMode(authModalMode);
  }, [authModalMode]);

  const clearGoogleLinkState = () => {
    setGoogleLinkEmail('');
    setGoogleLinkPassword('');
    setGoogleLinkCredential(null);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={() => setShowLoginModal(false)}
      ></div>
      
      <div className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95">
        <button 
            onClick={() => setShowLoginModal(false)} 
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
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
            <h2 className="text-2xl font-black text-white mb-1">
                {isLinkingGoogle ? 'Link Google Account' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-gray-500 text-sm">
                {isLinkingGoogle
                    ? 'Confirm your password to link Google with your existing account.'
                    : mode === 'login'
                        ? 'Sign in to access your Pullz.gg account'
                        : 'Join Pullz.gg and start winning today'}
            </p>
        </div>

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

        {!isLinkingGoogle && (
            <>
                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-white/10 bg-[#1f1f1f] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2a2a2a] disabled:opacity-50"
                >
                    <img
                        src={googleLogo}
                        alt="Google"
                        className="h-5 w-5"
                    />
                    Continue with Google
                </button>

                <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1 bg-gray-700" />
                    <span className="text-xs uppercase text-gray-500">or</span>
                    <div className="h-px flex-1 bg-gray-700" />
                </div>
            </>
        )}

        {isLinkingGoogle ? (
            <form onSubmit={handleLinkGoogleAccount} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            type="email"
                            value={googleLinkEmail}
                            readOnly
                            className="pl-10 pr-4 py-3 !text-white/60"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            type="password"
                            value={googleLinkPassword}
                            onChange={(e) => setGoogleLinkPassword(e.target.value)}
                            className="pl-10 pr-4 py-3"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                >
                    {isLoading ? 'Linking...' : 'Link Google'}
                </button>

                <button
                    type="button"
                    onClick={clearGoogleLinkState}
                    className="w-full text-xs text-gray-400 hover:text-gray-200"
                >
                    Back to sign in
                </button>
            </form>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                    <div className="animate-in slide-in-from-left-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10 pr-4 py-3"
                                placeholder="Display Name"
                                required
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 pr-4 py-3"
                            placeholder="user@example.com"
                            required
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 pr-4 py-3"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                </div>

                {mode === 'login' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <label className="flex items-center gap-2 text-gray-400">
                            <Checkbox
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>Remember me</span>
                        </label>
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                            disabled={isLoading}
                        >
                            Forgot password?
                        </button>
                    </div>
                )}

                {mode === 'register' && (
                    <div className="space-y-3 text-xs text-gray-400">
                        <label className="flex items-start gap-2">
                            <Checkbox
                                required
                                checked={confirmAdult}
                                onChange={(e) => setConfirmAdult(e.target.checked)}
                                className="mt-0.5"
                            />
                            <span>I confirm that I am 18 years or older.</span>
                        </label>
                        <label className="flex items-start gap-2">
                            <Checkbox
                                required
                                checked={acceptTerms}
                                onChange={(e) => setAcceptTerms(e.target.checked)}
                                className="mt-0.5"
                            />
                            <span>I agree to the Terms &amp; Conditions.</span>
                        </label>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20' : 'bg-green-600 hover:bg-green-500 shadow-green-600/20'}`}
                >
                    {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
            </form>
        )}

        {!isLinkingGoogle && (
            <div className="mt-6 text-center text-xs text-gray-500">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                <span 
                    onClick={toggleMode}
                    className="text-blue-400 font-bold cursor-pointer hover:underline ml-1"
                >
                    {mode === 'login' ? 'Register now' : 'Sign in'}
                </span>
            </div>
        )}
      </div>
    </div>
  );
};
