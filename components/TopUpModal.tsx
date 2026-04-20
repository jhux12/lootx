import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { auth } from '../firebase';
import { CoinAmount } from './CoinAmount';
import { readCookieValue, trackMetaEvent } from '../utils/trackEvent';
import { toast } from '../src/ui/toast/toast';

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
  const isPostFreeBoxFlow = topUpModalIntent?.source === 'post_free_box';
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

  const defaultPackage = useMemo(
    () => activePackages.find((pkg) => pkg.defaultSelected) ?? activePackages[0],
    [activePackages]
  );
  const selectedPackage = activePackages.find((pkg) => pkg.id === selectedPackageId) ?? defaultPackage;
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
  const getPackageImage = (pack: typeof activePackages[number]) =>
    pack.imageUrl?.trim() ||
    'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/item_images%2F12.png?alt=media&token=a82f5343-7e3e-4cb9-9d7a-b0451d4e49b0';
  const getBonusLabel = (pack: typeof activePackages[number]) => {
    const baseCoins = Math.max(0, Number(pack.coins ?? 0));
    const bonusCoins = Math.max(0, Number(pack.bonusCoins ?? 0));
    if (!baseCoins || bonusCoins <= 0) return '';
    const bonusPercent = Math.round((bonusCoins / baseCoins) * 100);
    return `+${bonusPercent}% BONUS${bonusPercent === 50 ? ' 🔥' : ''}`;
  };
  const getBonusSummaryLabel = (pack?: typeof activePackages[number]) => {
    if (!pack) return '';
    const baseCoins = Math.max(0, Number(pack.coins ?? 0));
    const bonusCoins = Math.max(0, Number(pack.bonusCoins ?? 0));
    if (!baseCoins || bonusCoins <= 0) return '';
    const bonusPercent = Math.round((bonusCoins / baseCoins) * 100);
    return `(+${bonusPercent}% BONUS)`;
  };
  const getBadgeClasses = (badge?: string) => {
    const normalizedBadge = badge?.toLowerCase() ?? '';
    if (normalizedBadge.includes('best')) {
      return 'bg-amber-400 text-black';
    }
    if (normalizedBadge.includes('popular')) {
      return 'bg-violet-500 text-white';
    }
    return 'bg-white/20 text-white';
  };
  const getCardAccentClasses = (badge?: string, isSelected?: boolean) => {
    const normalizedBadge = badge?.toLowerCase() ?? '';
    if (normalizedBadge.includes('best')) {
      return isSelected
        ? 'border-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.6),0_0_24px_rgba(245,158,11,0.45)]'
        : 'border-amber-300/70';
    }
    if (normalizedBadge.includes('popular')) {
      return isSelected
        ? 'border-violet-300 shadow-[0_0_0_1px_rgba(196,181,253,0.5),0_0_24px_rgba(139,92,246,0.35)]'
        : 'border-violet-300/50';
    }
    return isSelected
      ? 'border-cyan-300 shadow-[0_0_0_1px_rgba(125,211,252,0.5),0_0_20px_rgba(34,211,238,0.3)]'
      : 'border-indigo-400/40';
  };
  const parseDisplayPrice = (value: string) => {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  React.useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const originalDocumentOverflow = document.documentElement.style.overflow;
    const originalDocumentOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscrollBehavior;
      document.documentElement.style.overflow = originalDocumentOverflow;
      document.documentElement.style.overscrollBehavior = originalDocumentOverscrollBehavior;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedPackageId && defaultPackage) {
      setSelectedPackageId(defaultPackage.id);
    }
  }, [defaultPackage, selectedPackageId]);

  React.useEffect(() => {
    if (!isPostFreeBoxFlow || activePackages.length === 0) {
      return;
    }

    const preferredUsd = Number(topUpModalIntent?.preferredPackageUsd ?? 50);
    const preferredPackage = activePackages.find((pkg) => Math.abs(parseDisplayPrice(pkg.displayPrice) - preferredUsd) < 0.001);
    if (!preferredPackage) return;
    setRecommendedPackageId(preferredPackage.id);
    setSelectedPackageId(preferredPackage.id);
    setHasUserSelectedPackage(false);
    autoSelectAppliedRef.current = true;
  }, [activePackages, isPostFreeBoxFlow, topUpModalIntent?.preferredPackageUsd]);

  React.useEffect(() => {
    if (isPostFreeBoxFlow) {
      return;
    }
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
  }, [isInsufficientBalanceFlow, normalizedPackages, missingCoins, hasUserSelectedPackage, isPostFreeBoxFlow]);

  const handleClose = () => {
    if (isPostFreeBoxFlow && missingCoins > 0) {
      toast.info(`You’re still ${missingCoins.toLocaleString()} coins away from your first box`);
    }
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
    <div data-disable-pull-refresh="true" className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden overscroll-none p-3 py-4 sm:p-4 sm:py-6 sm:items-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={handleClose}
      ></div>
      
      <div className="relative flex max-h-[calc(100dvh-2rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/20 bg-[#08090d] shadow-2xl shadow-black/60 animate-in zoom-in-95">
        
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
                        <p className="mt-1 text-xs text-gray-400 sm:text-sm">Select a coin package</p>
                      </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-6">
                    {isPostFreeBoxFlow && (
                      <p className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                        Covers your first box + extra spins
                      </p>
                    )}
                    {/* Amount Selector */}
                    <label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-gray-500">Select a pack</label>
                    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {activePackages.length === 0 ? (
                          <div className="col-span-full rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-6 text-center text-xs text-gray-500">
                            No packages available right now.
                          </div>
                        ) : (
                          activePackages.map((pack) => {
                            const isSelected = selectedPackage?.id === pack.id;
                            const bonusCoins = pack.bonusCoins ?? 0;
                            const bonusLabel = getBonusLabel(pack);
                            const badgeText = pack.badge?.trim() ?? '';
                            return (
                              <button
                                  key={pack.id}
                                  onClick={() => {
                                    setSelectedPackageId(pack.id);
                                    setHasUserSelectedPackage(true);
                                    playSound('click');
                                  }}
                                  className={`group relative overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_55%_70%,rgba(82,31,173,0.5),rgba(7,8,17,0.92)_58%)] p-4 text-left transition-all duration-300
                                    hover:-translate-y-0.5
                                    ${getCardAccentClasses(pack.badge, isSelected)}
                                    ${isSelected ? 'scale-[1.015]' : ''}`}
                              >
                                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(129,140,248,0.15),transparent_45%)]" />
                                  {badgeText && (
                                    <span
                                      className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide shadow-lg ${getBadgeClasses(pack.badge)}`}
                                    >
                                      {badgeText}
                                    </span>
                                  )}
                                  <div className="relative z-10 flex items-start justify-between gap-2">
                                    <div>
                                      <CoinAmount
                                        amount={pack.coins}
                                        formatOptions={{ maximumFractionDigits: 0 }}
                                        className="text-3xl font-black text-white sm:text-[2.1rem]"
                                        iconClassName="h-6 w-6"
                                      />
                                      <p className="mt-1 text-lg font-bold uppercase tracking-wide text-slate-300/90">
                                        Coins
                                      </p>
                                    </div>
                                  </div>
                                  <div className="relative z-10 mb-3 mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/10 p-2.5">
                                    <img
                                      src={getPackageImage(pack)}
                                      alt={pack.name}
                                      className="h-28 w-full object-contain sm:h-32"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </div>
                                  <div className="relative z-10 flex flex-col gap-2">
                                    {bonusCoins > 0 && bonusLabel && (
                                      <span className="text-center text-2xl font-black tracking-wide text-violet-300">
                                        {bonusLabel}
                                      </span>
                                    )}
                                    <div className={`rounded-xl px-3 py-2 text-center text-3xl font-black leading-none sm:text-4xl ${isSelected ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white' : 'border border-white/20 bg-[#0f1230] text-white'}`}>
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
                <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#10131c]/95 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4">
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Total Amount</p>
                  <div className="mb-3.5 flex items-center justify-between rounded-xl border border-white/10 bg-[#1a2030] px-3 py-3 sm:px-4">
                    <CoinAmount
                      amount={selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="text-xl font-black text-white"
                      iconClassName="h-5 w-5"
                    />
                    <span className="text-sm font-semibold text-cyan-300">
                      You get {Math.round(selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))).toLocaleString()} coins{' '}
                      {getBonusSummaryLabel(selectedPackage)}
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
                      <span>
                        Get {Math.round(selectedPackage?.totalCoins ?? ((selectedPackage?.coins ?? 0) + (selectedPackage?.bonusCoins ?? 0))).toLocaleString()} Coins for {formattedDepositAmount}
                      </span>
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
