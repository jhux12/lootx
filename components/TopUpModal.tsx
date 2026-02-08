import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { auth } from '../firebase';
import { CoinAmount } from './CoinAmount';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const TopUpModal: React.FC = () => {
  const { setShowTopUpModal, coinPackages } = useGame();
  const { playSound } = useSound();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activePackages = useMemo(() => {
    return coinPackages
      .filter((pkg) => pkg.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [coinPackages]);
  const selectedPackage = activePackages.find((pkg) => pkg.id === selectedPackageId) ?? activePackages[0];
  const formattedDepositAmount = selectedPackage?.displayPrice ?? '$0.00';
  const priceValue = useMemo(() => {
    const raw = formattedDepositAmount.replace(/[^0-9.]/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [formattedDepositAmount]);
  const totalCoins = (selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0)));
  const effectiveRate = priceValue > 0 ? Math.round(totalCoins / priceValue) : null;
  const getBadgeClasses = (badge?: string) => {
    if (badge === 'best') {
      return 'border-amber-400/80 bg-amber-500/10 text-amber-100';
    }
    if (badge === 'good') {
      return 'border-sky-400/80 bg-sky-500/10 text-sky-100';
    }
    return 'border-white/10 bg-[#0b0e14] text-gray-300';
  };
  const getSelectedClasses = (badge?: string) => {
    if (badge === 'best') {
      return 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-900/20';
    }
    if (badge === 'good') {
      return 'border-sky-400 bg-sky-500/20 text-white shadow-lg shadow-sky-900/20';
    }
    return 'border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-900/20';
  };

  React.useEffect(() => {
    if (!selectedPackageId && activePackages[0]) {
      setSelectedPackageId(activePackages[0].id);
    }
  }, [activePackages, selectedPackageId]);

  const handleDeposit = async () => {
      playSound('click');
      if (!selectedPackage) {
        setErrorMessage('Please select a coin package.');
        return;
      }
      if (!auth.currentUser) {
        setErrorMessage('Please sign in to continue.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
          const token = await auth.currentUser.getIdToken();
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ packageId: selectedPackage.id })
          });
          if (!response.ok) {
            const message = await response.text();
            throw new Error(message || 'Unable to start checkout.');
          }
          const data = await response.json();
          const stripe = await stripePromise;
          if (!stripe) {
            throw new Error('Stripe failed to initialize.');
          }
          const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (result.error) {
            throw result.error;
          }
      } catch (error: any) {
          setErrorMessage(error?.message ?? 'Checkout failed. Please try again.');
          setIsLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 py-6 sm:items-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={() => setShowTopUpModal(false)}
      ></div>
      
      <div className="relative w-full max-w-md max-h-[calc(100dvh-3rem)] min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0f131c] shadow-2xl animate-in zoom-in-95 flex flex-col sm:max-h-[calc(100dvh-2rem)]">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                        <Wallet className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Top up</h2>
                        <p className="text-xs text-gray-500">Choose a coin package</p>
                      </div>
                    </div>
                    <button 
                        onClick={() => setShowTopUpModal(false)} 
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                    {/* Amount Selector */}
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Select a pack</label>
                    <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3">
                        {activePackages.length === 0 ? (
                          <div className="col-span-full rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-6 text-center text-xs text-gray-500">
                            No packages available right now.
                          </div>
                        ) : (
                          activePackages.map((pack) => {
                            const isSelected = selectedPackage?.id === pack.id;
                            const bonusCoins = pack.bonusCoins ?? 0;
                            return (
                              <button
                                  key={pack.id}
                                  onClick={() => { setSelectedPackageId(pack.id); playSound('click'); }}
                                  className={`relative rounded-xl border px-3 py-3 text-left transition-all ${isSelected ? getSelectedClasses(pack.badge) : `${getBadgeClasses(pack.badge)} hover:border-white/30`}`}
                              >
                                  {pack.badge && (
                                    <span
                                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                        pack.badge === 'best'
                                          ? 'bg-amber-500 text-black'
                                          : 'bg-sky-500 text-black'
                                      }`}
                                    >
                                      {pack.badge === 'best' ? 'Best value' : 'Good value'}
                                    </span>
                                  )}
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-semibold text-gray-400">{pack.displayPrice}</span>
                                    <CoinAmount
                                      amount={pack.coins}
                                      formatOptions={{ maximumFractionDigits: 0 }}
                                      className="text-white"
                                      iconClassName="w-3.5 h-3.5"
                                    />
                                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                      <span>{pack.coins.toLocaleString()}</span>
                                      {bonusCoins > 0 && (
                                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                                          +{bonusCoins.toLocaleString()} bonus
                                        </span>
                                      )}
                                    </div>
                                  </div>
                              </button>
                            );
                          })
                        )}
                    </div>

                    {errorMessage && (
                      <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                        {errorMessage}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button 
                        onClick={handleDeposit}
                        disabled={isLoading || !selectedPackage}
                        className="w-full rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                            </>
                        ) : (
                            <span className="inline-flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2">
                              <span>Deposit {formattedDepositAmount}</span>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 sm:text-sm">
                                <CoinAmount
                                  amount={selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))}
                                  formatOptions={{ maximumFractionDigits: 0 }}
                                  className="text-white"
                                  iconClassName="w-4 h-4"
                                />
                                coins
                              </span>
                            </span>
                        )}
                    </button>

                    <img
  src="https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/item_images%2F12.png?alt=media&token=a82f5343-7e3e-4cb9-9d7a-b0451d4e49b0"
  alt="Secure checkout"
  className="mx-auto mt-3 h-24 opacity-80"
/>

<p className="text-center text-[10px] text-gray-500 mt-2">
  By depositing you agree to our Terms of Service.
</p>

                </div>
            </>
        )}
      </div>
    </div>
  );
};
