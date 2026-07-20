import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { getStripe } from '../utils/stripeClient';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { auth } from '../firebase';
import { CoinAmount } from './CoinAmount';
import { PaymentMethodIcons } from './PaymentMethodIcons';
import { readCookieValue, trackMetaEvent } from '../utils/trackEvent';
import { toast } from '../src/ui/toast/toast';
import { hasUserMadeDeposit } from '../utils/depositEligibility';
import { lockPageScroll } from '../utils/scrollLock';
import { getAttribution, getGaClientId, trackBeginCheckout } from '../services/analytics';


const generateCheckoutEventId = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `checkout_${Date.now()}_${random}`;
};

export const TopUpModal: React.FC = () => {
  const {
    user,
    setShowTopUpModal,
    setTopUpModalIntent,
    topUpModalIntent,
    coinPackages,
    coinPackagesLoading,
    coinPackagesLoaded,
    coinPackagesError,
    refreshCoinPackages
  } = useGame();
  const { playSound } = useSound();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [hasUserSelectedPackage, setHasUserSelectedPackage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recommendedPackageId, setRecommendedPackageId] = useState<string | null>(null);
  const [showFirstDepositPackages, setShowFirstDepositPackages] = useState(false);
  const autoSelectAppliedRef = React.useRef(false);
  const isPostFreeBoxFlow = topUpModalIntent?.source === 'post_free_box';
  const activePackages = useMemo(() => {
    return coinPackages
      .filter((pkg) => pkg.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [coinPackages]);

  const isFirstDepositEligible = !hasUserMadeDeposit(user);
  const firstDepositPackages = useMemo(
    () => activePackages.filter((pkg) => pkg.firstTimeDepositOnly),
    [activePackages]
  );
  const standardPackages = useMemo(
    () => activePackages.filter((pkg) => !pkg.firstTimeDepositOnly),
    [activePackages]
  );
  const isInitialPackagesLoading = coinPackagesLoading && coinPackages.length === 0;

  const displayedPackages = useMemo(() => {
    if (isFirstDepositEligible && showFirstDepositPackages) {
      return firstDepositPackages;
    }
    return standardPackages;
  }, [firstDepositPackages, isFirstDepositEligible, showFirstDepositPackages, standardPackages]);

  const normalizedPackages = useMemo(() => {
    return displayedPackages.map((pkg) => ({
      ...pkg,
      baseCoinsNormalized: Number(pkg.coins ?? 0)
    }));
  }, [displayedPackages]);

  const defaultPackage = useMemo(
    () => displayedPackages.find((pkg) => pkg.defaultSelected) ?? displayedPackages[0],
    [displayedPackages]
  );
  const selectedPackage = displayedPackages.find((pkg) => pkg.id === selectedPackageId) ?? defaultPackage;
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
  const getPackageImage = (pack: typeof displayedPackages[number]) =>
    pack.imageUrl?.trim() ||
    'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/item_images%2F12.png?alt=media&token=a82f5343-7e3e-4cb9-9d7a-b0451d4e49b0';
  const getBonusLabel = (pack: typeof displayedPackages[number]) => {
    const baseCoins = Math.max(0, Number(pack.coins ?? 0));
    const bonusCoins = Math.max(0, Number(pack.bonusCoins ?? 0));
    if (!baseCoins || bonusCoins <= 0) return '';
    const bonusPercent = Math.round((bonusCoins / baseCoins) * 100);
    if (pack.firstTimeDepositOnly && bonusPercent === 50) return '50% DEPOSIT MATCH';
    return `+${bonusPercent}% BONUS`;
  };
  const getBonusSummaryLabel = (pack?: typeof displayedPackages[number]) => {
    if (!pack) return '';
    const baseCoins = Math.max(0, Number(pack.coins ?? 0));
    const bonusCoins = Math.max(0, Number(pack.bonusCoins ?? 0));
    if (!baseCoins || bonusCoins <= 0) return '';
    const bonusPercent = Math.round((bonusCoins / baseCoins) * 100);
    if (pack.firstTimeDepositOnly && bonusPercent === 50) return '(50% DEPOSIT MATCH)';
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


  const renderPackageCard = (pack: typeof displayedPackages[number]) => {
    const isSelected = selectedPackage?.id === pack.id;
    const bonusCoins = pack.bonusCoins ?? 0;
    const bonusLabel = pack.firstTimeDepositOnly ? '' : getBonusLabel(pack);
    const badgeText = pack.badge?.trim() ?? '';

    return (
      <button
        key={pack.id}
        onClick={() => {
          setSelectedPackageId(pack.id);
          setHasUserSelectedPackage(true);
          playSound('click');
        }}
        className={`relative flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200 bg-[#1b2024] hover:bg-[#222a30]
          ${isSelected ? 'border-[#f7b733] shadow-[inset_0_0_0_1px_rgba(247,183,51,0.75),0_0_18px_rgba(247,183,51,0.25)]' : 'border-white/10'}`}
      >
        <div className="flex min-w-0 flex-col">
          {badgeText && (
            <span
              className={`mb-1 w-fit rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${getBadgeClasses(pack.badge)}`}
            >
              {getBadgeLabel(badgeText)}
            </span>
          )}
          <CoinAmount amount={pack.coins} formatOptions={{ maximumFractionDigits: 0 }} className="text-lg font-bold text-white" iconClassName="h-4 w-4" />
          {bonusCoins > 0 && bonusLabel && <span className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-200">{bonusLabel}</span>}
        </div>
        <span className="shrink-0 text-base font-bold text-white">{pack.displayPrice}</span>
      </button>
    );
  };

  React.useEffect(() => lockPageScroll({ preserveScrollPosition: true }), []);

  React.useEffect(() => {
    if (!isFirstDepositEligible && showFirstDepositPackages) {
      setShowFirstDepositPackages(false);
    }
  }, [isFirstDepositEligible, showFirstDepositPackages]);

  React.useEffect(() => {
    if (!defaultPackage) {
      setSelectedPackageId(null);
      return;
    }
    if (!selectedPackageId || !displayedPackages.some((pkg) => pkg.id === selectedPackageId)) {
      setSelectedPackageId(defaultPackage.id);
      setHasUserSelectedPackage(false);
      autoSelectAppliedRef.current = false;
    }
  }, [defaultPackage, displayedPackages, selectedPackageId]);

  React.useEffect(() => {
    if (!isPostFreeBoxFlow || displayedPackages.length === 0) {
      return;
    }

    const preferredUsd = Number(topUpModalIntent?.preferredPackageUsd ?? 50);
    const preferredPackage = displayedPackages.find((pkg) => Math.abs(parseDisplayPrice(pkg.displayPrice) - preferredUsd) < 0.001);
    if (!preferredPackage) return;
    setRecommendedPackageId(preferredPackage.id);
    setSelectedPackageId(preferredPackage.id);
    setHasUserSelectedPackage(false);
    autoSelectAppliedRef.current = true;
  }, [displayedPackages, isPostFreeBoxFlow, topUpModalIntent?.preferredPackageUsd]);

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
              fbc,
              gaClientId: getGaClientId(),
              attribution: getAttribution(),
              checkoutSource: topUpModalIntent?.source ?? 'top_up_modal'
            })
          });
          if (!response.ok) {
            const message = await response.text();
            throw new Error(message || 'Unable to start checkout.');
          }
          const data = await response.json();
          trackBeginCheckout({ currency: 'USD', value: priceValue, payment_type: 'stripe', items: [{ item_id: selectedPackage.id, item_name: selectedPackage.name || selectedPackage.id, item_category: 'coin_package', price: priceValue, quantity: 1 }], coin_amount: Number(selectedPackage.coins ?? 0), bonus_coin_amount: Number(selectedPackage.bonusCoins ?? 0), package_id: selectedPackage.id, checkout_session_id: data.sessionId, is_first_deposit_intent: isFirstDepositEligible, checkout_source: topUpModalIntent?.source ?? 'top_up_modal', missing_coins: isInsufficientBalanceFlow ? missingCoins : undefined }, data.sessionId);
          const stripe = await getStripe();
          if (!stripe) {
            throw new Error('Stripe failed to initialize.');
          }
          const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (result.error) {
            throw result.error;
          }
      } catch (error: unknown) {
          setErrorMessage(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
          setIsLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto overscroll-contain p-0 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:overflow-hidden sm:p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={handleClose}
      ></div>
      
      <div className="relative my-auto flex max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 w-full max-w-[390px] flex-col overflow-hidden rounded-t-[18px] border border-[rgba(124,92,255,0.2)] bg-[#1b2024] shadow-[0_0_40px_rgba(124,92,255,0.15)] animate-in zoom-in-95 sm:max-h-[min(680px,calc(100dvh-2rem))] sm:rounded-[18px]">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex items-start justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                        <Wallet className="h-5 w-5 text-amber-300" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Add Coins</h2>
                      </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 px-4 py-3 sm:px-5">
                    {isPostFreeBoxFlow && (
                      <p className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                        Covers your first box + extra spins
                      </p>
                    )}
                    {coinPackagesLoaded && isFirstDepositEligible && firstDepositPackages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowFirstDepositPackages((current) => !current);
                          setHasUserSelectedPackage(false);
                          autoSelectAppliedRef.current = false;
                          playSound('click');
                        }}
                        className={`mb-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          showFirstDepositPackages
                            ? 'border-amber-300/60 bg-[linear-gradient(135deg,rgba(247,183,51,0.22),rgba(124,92,255,0.18))] shadow-[0_0_24px_rgba(247,183,51,0.16)]'
                            : 'border-white/10 bg-white/[0.04] hover:border-amber-300/35 hover:bg-white/[0.07]'
                        }`}
                        aria-pressed={showFirstDepositPackages}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200">
                            <Sparkles className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-extrabold text-white">First time deposit offers</span>
                          </span>
                        </span>
                        <span className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${showFirstDepositPackages ? 'bg-amber-300' : 'bg-slate-700'}`}>
                          <span className={`block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${showFirstDepositPackages ? 'translate-x-5' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    )}
                    {/* Amount Selector */}
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-200">Select a pack</label>
                    <div className="mb-3 max-h-[min(44dvh,320px)] overflow-y-auto overscroll-contain px-1 py-1 [-webkit-overflow-scrolling:touch]">
                    <div className="flex flex-col gap-3">
                        {isInitialPackagesLoading ? (
                          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-8 text-center text-xs text-gray-400">
                            <Loader2 className="mb-2 h-6 w-6 animate-spin text-cyan-300" />
                            <span>Loading coin packages...</span>
                          </div>
                        ) : coinPackagesError && coinPackages.length === 0 ? (
                          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-xs text-red-100">
                            <span>Unable to load coin packages.</span>
                            <button
                              type="button"
                              onClick={() => {
                                void refreshCoinPackages();
                              }}
                              className="mt-3 rounded-lg border border-red-200/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                            >
                              Try again
                            </button>
                          </div>
                        ) : coinPackagesError && coinPackages.length > 0 ? (
                          <>
                            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                              Showing the last loaded packages while refresh is unavailable.
                              <button
                                type="button"
                                onClick={() => {
                                  void refreshCoinPackages();
                                }}
                                className="ml-2 font-semibold underline decoration-amber-200/60 underline-offset-2"
                              >
                                Retry
                              </button>
                            </div>
                            {displayedPackages.map(renderPackageCard)}
                          </>
                        ) : coinPackagesLoaded && !coinPackagesLoading && displayedPackages.length === 0 ? (
                          <div className="col-span-full rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-6 text-center text-xs text-gray-500">
                            {showFirstDepositPackages ? 'No first-time deposit packages available right now.' : 'No packages available right now.'}
                          </div>
                        ) : (
                          displayedPackages.map(renderPackageCard)
                        )}
                    </div>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                        {errorMessage}
                      </div>
                    )}

                </div>
                <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#1b2024]/95 px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-5">
                  <button
                    onClick={handleDeposit}
                    disabled={isLoading || isInitialPackagesLoading || !selectedPackage}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7C5CFF,#00E5FF)] text-base font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="mt-2 text-center text-[11px] text-white/60">Secure checkout • Instant delivery</p>
                  <PaymentMethodIcons className="mt-2 gap-1.5 opacity-85" iconClassName="h-3.5 sm:h-4" />
                </div>
            </>
        )}
      </div>
    </div>
  );
};
