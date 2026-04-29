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
    return `+${bonusPercent}% BONUS`;
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
      return 'bg-[#f7b733] text-[#15120a]';
    }
    if (normalizedBadge.includes('popular')) {
      return 'bg-[#6652ff] text-[#e8e6ff]';
    }
    return 'bg-white/15 text-white';
  };
  const getCardAccentClasses = (badge?: string, isSelected?: boolean) => {
    const normalizedBadge = badge?.toLowerCase() ?? '';
    if (isSelected) {
      return 'border-[#f7b733] shadow-[0_0_0_1px_rgba(247,183,51,0.6)]';
    }
    if (normalizedBadge.includes('best')) {
      return 'border-[#9a7b22]';
    }
    if (normalizedBadge.includes('popular')) {
      return 'border-[#5446c8]';
    }
    return 'border-[#2d2e7c]';
  };
  const getCardSurface = (badge?: string, isSelected?: boolean) => {
    const normalizedBadge = badge?.toLowerCase() ?? '';
    if (isSelected || normalizedBadge.includes('best')) {
      return 'bg-[linear-gradient(180deg,#0a0a28_0%,#0b0d24_42%,#1a1023_100%)]';
    }
    return 'bg-[linear-gradient(180deg,#080b2e_0%,#070a24_55%,#060918_100%)]';
  };
  const getBadgeLabel = (badgeText: string) => {
    if (badgeText.toLowerCase().includes('best')) {
      return `★ ${badgeText}`;
    }
    if (badgeText.toLowerCase().includes('popular')) {
      return `★ ${badgeText}`;
    }
    return badgeText;
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
    <div data-disable-pull-refresh="true" className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden overscroll-none p-0 sm:items-center sm:p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={handleClose}
      ></div>
      
      <div className="relative flex max-h-[100dvh] min-h-0 w-full max-w-[380px] flex-col overflow-hidden rounded-t-[18px] border border-[rgba(124,92,255,0.2)] bg-[#1b2024] shadow-[0_0_40px_rgba(124,92,255,0.15)] animate-in zoom-in-95 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[18px]">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                        <Wallet className="h-5 w-5 text-amber-300" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">Add Coins</h2>
                        <p className="mt-1 text-xs text-slate-400">Select a coin package</p>
                      </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
                    {isPostFreeBoxFlow && (
                      <p className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                        Covers your first box + extra spins
                      </p>
                    )}
                    {/* Amount Selector */}
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Select a pack</label>
                    <div className="mb-4 flex flex-col gap-3">
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
                                  className={`relative flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-200 bg-[#1b2024] hover:bg-[#222a30]
                                    ${isSelected ? 'scale-[1.02] border-[#7C5CFF] shadow-[0_0_12px_rgba(124,92,255,0.4)]' : 'border-white/10'}`}
                              >
                                  {badgeText && (
                                    <span
                                      className={`absolute -top-2 right-3 rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${getBadgeClasses(pack.badge)}`}
                                    >
                                      {getBadgeLabel(badgeText)}
                                    </span>
                                  )}
                                  <div className="flex flex-col">
                                    <CoinAmount amount={pack.coins} formatOptions={{ maximumFractionDigits: 0 }} className="text-lg font-bold text-white" iconClassName="h-4 w-4" />
                                    {bonusCoins > 0 && bonusLabel && <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-cyan-300">{bonusLabel}</span>}
                                  </div>
                                  <span className="text-base font-bold text-white">{pack.displayPrice}</span>
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
                <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#1b2024]/95 px-5 py-4 backdrop-blur-md">
                  <button
                    onClick={handleDeposit}
                    disabled={isLoading || !selectedPackage}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7C5CFF,#00E5FF)] text-base font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="mt-3 text-center text-xs text-white/60">Secure checkout • Instant delivery</p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
