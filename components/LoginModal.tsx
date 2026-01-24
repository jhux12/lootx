import React, { useState } from 'react';
import { X, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BrandLockup } from './BrandLockup';

export const LoginModal: React.FC = () => {
  const { login, register, resetPassword, setShowLoginModal } = useGame();
  const { playSound } = useSound();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
            await login(email, password);
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
      setMode(prev => prev === 'login' ? 'register' : 'login');
      setError(null);
      setMessage(null);
      playSound('click');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={() => setShowLoginModal(false)}
      ></div>
      
      <div className="relative w-full max-w-md bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-8 animate-in zoom-in-95">
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
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-gray-500 text-sm">
                {mode === 'login' ? 'Sign in to access your LootX account' : 'Join LootX and start winning today'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
            
            {mode === 'register' && (
                <div className="animate-in slide-in-from-left-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Username</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-[#0b0e14] border border-gray-700 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-brand-purple transition-colors"
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
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#0b0e14] border border-gray-700 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-brand-purple transition-colors"
                        placeholder="user@example.com"
                        required
                    />
                </div>
            </div>
            
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#0b0e14] border border-gray-700 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-brand-purple transition-colors"
                        placeholder="••••••••"
                        required
                    />
                </div>
            </div>

            {mode === 'login' && (
                <div className="flex justify-end text-xs">
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
                        <input
                            type="checkbox"
                            required
                            checked={confirmAdult}
                            onChange={(e) => setConfirmAdult(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple"
                        />
                        <span>I confirm that I am 18 years or older.</span>
                    </label>
                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            required
                            checked={acceptTerms}
                            onChange={(e) => setAcceptTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple"
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

        <div className="mt-6 text-center text-xs text-gray-500">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <span 
                onClick={toggleMode}
                className="text-blue-400 font-bold cursor-pointer hover:underline ml-1"
            >
                {mode === 'login' ? 'Register now' : 'Sign in'}
            </span>
        </div>
      </div>
    </div>
  );
};
