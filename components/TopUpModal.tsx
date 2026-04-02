import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { auth } from '../firebase';
import { CoinAmount } from './CoinAmount';
import { readCookieValue, trackMetaEvent } from '../utils/trackEvent';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const generateCheckoutEventId = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `checkout_${Date.now()}_${random}`;
};

export const TopUpModal: React.FC = () => {
  const { setShowTopUpModal, setTopUpModalIntent, topUpModalIntent, coinPackages } = useGame();
  const { playSound } = useSound();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [hasUserSelectedPackage, setHasUserSelectedPackage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recommendedPackageId, setRecommendedPackageId] = useState<string | null>(null);
  const autoSelectAppliedRef = React.useRef(false);
  const activePackages = useMemo(() => {
    return coinPackages
      .filter((pkg) => pkg.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [coinPackages]);

  const normalizedPackages = useMemo(() => {
    return activePackages.map((pkg) => ({
      ...pkg,
      baseCoinsNormalized: Number(pkg.coins ?? 0)
    }));
  }, [activePackages]);

  const selectedPackage = activePackages.find((pkg) => pkg.id === selectedPackageId) ?? activePackages[0];
  const formattedDepositAmount = selectedPackage?.displayPrice ?? '$0.00';
  const priceValue = useMemo(() => {
    const raw = formattedDepositAmount.replace(/[^0-9.]/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [formattedDepositAmount]);
  const totalCoins = (selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0)));
  const effectiveRate = priceValue > 0 ? Math.round(totalCoins / priceValue) : null;
  const missingCoins = useMemo(() => {
    const requiredCoins = Number(topUpModalIntent?.requiredCoins ?? 0);
    const currentBalance = Number(topUpModalIntent?.currentBalance ?? 0);
    const explicitMissing = Number(topUpModalIntent?.missingCoins ?? (requiredCoins - currentBalance));
    const computedMissing = Number.isFinite(explicitMissing) ? explicitMissing : requiredCoins - currentBalance;
    return Math.max(0, computedMissing);
  }, [topUpModalIntent?.currentBalance, topUpModalIntent?.missingCoins, topUpModalIntent?.requiredCoins]);
  const isInsufficientBalanceFlow = topUpModalIntent?.reason === 'insufficient_balance' && missingCoins > 0;
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
  const getPackageImage = (pack: typeof activePackages[number]) =>
    pack.imageUrl?.trim() ||
    'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/item_images%2F12.png?alt=media&token=a82f5343-7e3e-4cb9-9d7a-b0451d4e49b0';

  React.useEffect(() => {
    if (!selectedPackageId && activePackages[0]) {
      setSelectedPackageId(activePackages[0].id);
    }
  }, [activePackages, selectedPackageId]);

  React.useEffect(() => {
    if (!isInsufficientBalanceFlow || normalizedPackages.length === 0) {
      autoSelectAppliedRef.current = false;
      setRecommendedPackageId(null);
      return;
    }

    const sortedByCoins = [...normalizedPackages].sort((a, b) => a.baseCoinsNormalized - b.baseCoinsNormalized);
    const smallestCovering = sortedByCoins.find((pkg) => pkg.baseCoinsNormalized >= missingCoins);
    const recommended = smallestCovering ?? sortedByCoins[sortedByCoins.length - 1];

    setRecommendedPackageId(recommended?.id ?? null);

    if (!recommended || hasUserSelectedPackage || autoSelectAppliedRef.current) {
      return;
    }

    autoSelectAppliedRef.current = true;
    setSelectedPackageId(recommended.id);
  }, [isInsufficientBalanceFlow, normalizedPackages, missingCoins, hasUserSelectedPackage]);

  const handleClose = () => {
    setTopUpModalIntent(null);
    setShowTopUpModal(false);
  };

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
          const eventId = generateCheckoutEventId();
          const fbp = readCookieValue('_fbp');
          const fbc = readCookieValue('_fbc');
          trackMetaEvent('InitiateCheckout', {
            currency: 'USD',
            value: priceValue,
            num_items: 1
          }, { eventID: eventId });

          const token = await auth.currentUser.getIdToken();
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              packageId: selectedPackage.id,
              eventId,
              fbp,
              fbc
            })
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 py-4 sm:p-4 sm:py-6 sm:items-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={handleClose}
      ></div>
      
      <div className="relative flex max-h-[calc(100dvh-2rem)] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-500/20 bg-[#08090d] shadow-2xl shadow-black/60 animate-in zoom-in-95">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex items-start justify-between border-b border-white/10 px-4 py-4 sm:px-6">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                        <Wallet className="h-5 w-5 text-amber-300" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white sm:text-3xl">Get Coins</h2>
                        <p className="mt-1 text-xs text-gray-400 sm:text-sm">How many credits would you like?</p>
                      </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
                    {/* Amount Selector */}
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">Select a pack</label>
                    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                                  onClick={() => {
                                    setSelectedPackageId(pack.id);
                                    setHasUserSelectedPackage(true);
                                    playSound('click');
                                  }}
                                  className={`relative rounded-xl border bg-[#15171c] p-3 text-left transition-all ${isSelected ? getSelectedClasses(pack.badge) : `${getBadgeClasses(pack.badge)} hover:border-white/30`}`}
                              >
                                  {pack.badge && (
                                    <span
                                      className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                        pack.badge === 'best'
                                          ? 'bg-amber-500 text-black'
                                          : 'bg-sky-500 text-black'
                                      }`}
                                    >
                                      {pack.badge === 'best' ? 'Best value' : 'Good value'}
                                    </span>
                                  )}
                                  <div className="mb-2 overflow-hidden rounded-lg border border-white/5 bg-black/20 p-2">
                                    <img
                                      src={getPackageImage(pack)}
                                      alt={pack.name}
                                      className="h-28 w-full object-contain sm:h-32"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <CoinAmount
                                      amount={pack.coins}
                                      formatOptions={{ maximumFractionDigits: 0 }}
                                      className="text-lg font-black text-white"
                                      iconClassName="w-3.5 h-3.5"
                                    />
                                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                      <span className="text-xs font-semibold text-gray-300">{pack.name}</span>
                                      {bonusCoins > 0 && (
                                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                          +{bonusCoins.toLocaleString()} DUST
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-center text-lg font-black text-white">
                                      {pack.displayPrice}
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

                </div>
                <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#10131c]/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Total Amount</p>
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#1a2030] px-3 py-2.5 sm:px-4">
                    <CoinAmount
                      amount={selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="text-xl font-black text-white"
                      iconClassName="h-5 w-5"
                    />
                    <span className="text-sm font-semibold text-cyan-300">
                      {selectedPackage?.coins?.toLocaleString() ?? 0}
                      {Number(selectedPackage?.bonusCoins ?? 0) > 0 ? ` + ${(selectedPackage?.bonusCoins ?? 0).toLocaleString()} BONUS` : ''}
                    </span>
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={isLoading || !selectedPackage}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                      </>
                    ) : (
                      <span>Buy for {formattedDepositAmount}</span>
                    )}
                  </button>
                  <p className="mt-2 text-center text-[10px] text-gray-500">
                    By depositing you agree to our Terms of Service.
                  </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
