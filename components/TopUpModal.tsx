import React, { useMemo, useState } from 'react';
import { X, CreditCard, Wallet, Bitcoin, Loader2, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { auth } from '../firebase';
import { CoinAmount } from './CoinAmount';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const TopUpModal: React.FC = () => {
  const { setShowTopUpModal, coinPackages } = useGame();
  const { playSound } = useSound();
  const [method, setMethod] = useState<'card' | 'crypto'>('card');
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
                    {/* Method Selector */}
                    <div className="flex gap-3 mb-5">
                        <button 
                            onClick={() => { setMethod('card'); playSound('click'); }}
                            className={`flex-1 rounded-xl border px-3 py-3 text-left transition-all ${method === 'card' ? 'border-blue-400 bg-blue-500/10 text-white shadow-lg shadow-blue-900/10' : 'border-white/10 bg-[#0b0e14] text-gray-400 hover:border-white/30'}`}
                        >
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-5 h-5" />
                              <span className="text-xs font-semibold">Card</span>
                            </div>
                            <span className="mt-2 block text-[11px] text-gray-500">Instant approval</span>
                        </button>
                        <button 
                            onClick={() => { setMethod('crypto'); playSound('click'); }}
                            className={`flex-1 rounded-xl border px-3 py-3 text-left transition-all ${method === 'crypto' ? 'border-orange-400 bg-orange-500/10 text-white shadow-lg shadow-orange-900/10' : 'border-white/10 bg-[#0b0e14] text-gray-400 hover:border-white/30'}`}
                        >
                            <div className="flex items-center gap-2">
                              <Bitcoin className="w-5 h-5" />
                              <span className="text-xs font-semibold">Crypto</span>
                            </div>
                            <span className="mt-2 block text-[11px] text-gray-500">BTC, ETH, USDC</span>
                        </button>
                    </div>

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
                            const totalCoins = pack.totalCoins ?? pack.coins + bonusCoins;
                            return (
                              <button
                                  key={pack.id}
                                  onClick={() => { setSelectedPackageId(pack.id); playSound('click'); }}
                                  className={`relative rounded-xl border px-3 py-3 text-left transition-all ${isSelected ? 'border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-900/20' : 'border-white/10 bg-[#0b0e14] text-gray-300 hover:border-white/30'}`}
                              >
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-semibold text-gray-400">{pack.displayPrice}</span>
                                    <CoinAmount
                                      amount={totalCoins / 100}
                                      formatOptions={{ maximumFractionDigits: 0 }}
                                      className="text-white"
                                      iconClassName="w-3.5 h-3.5"
                                    />
                                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                      <span>{pack.coins.toLocaleString()} base</span>
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

                    <div className="mb-5 rounded-2xl border border-white/10 bg-[#121826] p-4">
                      <p className="text-xs font-semibold uppercase text-emerald-200">You get</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <CoinAmount
                          amount={(selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))) / 100}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="text-lg font-black text-white"
                          iconClassName="w-5 h-5"
                        />
                        <div className="text-right text-xs text-emerald-200">
                          <div>{formattedDepositAmount} deposit</div>
                          {(selectedPackage?.bonusCoins ?? 0) > 0 && (
                            <div className="text-[11px] text-emerald-100">
                              +{(selectedPackage?.bonusCoins ?? 0).toLocaleString()} bonus coins
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-100/80">
                        <span>Base coins</span>
                        <span>{(selectedPackage?.coins ?? 0).toLocaleString()}</span>
                      </div>
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
                                  amount={(selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))) / 100}
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
  src="https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/item_images%2Fpaymenticons.png?alt=media&token=3d0ffe13-70a5-455a-9bde-ffec5a5369e4"
  alt="Secure checkout"
  className="mx-auto mt-4 h-6 opacity-80"
/>

<p className="text-center text-[10px] text-gray-500 mt-2">
  By depositing you agree to our Terms of Service.
</p>
                    <p className="text-center text-[10px] text-gray-500 mt-4">
                        By depositing you agree to our Terms of Service.
                    </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
