import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, CheckCircle, Shield, Lock, Sparkles, ArrowRight } from 'lucide-react';
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
  const getBadgeClasses = (badge?: string) => {
    const normalizedBadge = badge?.toLowerCase() ?? '';
    if (normalizedBadge.includes('best')) {
      return 'border-amber-400/80 bg-amber-500/10 text-amber-100';
    }
    if (normalizedBadge.includes('good')) {
      return 'border-sky-400/80 bg-sky-500/10 text-sky-100';
    }
    return 'border-white/10 bg-[#0b0e14] text-gray-300';
  };
  const getSelectedClasses = (badge?: string) => {
    const normalizedBadge = badge?.toLowerCase() ?? '';
    if (normalizedBadge.includes('best')) {
      return 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-900/20';
    }
    if (normalizedBadge.includes('good')) {
      return 'border-sky-400 bg-sky-500/20 text-white shadow-lg shadow-sky-900/20';
    }
    return 'border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-900/20';
  };
  const getPackageImage = (pack: typeof activePackages[number]) =>
    pack.imageUrl?.trim() ||
    'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/item_images%2F12.png?alt=media&token=a82f5343-7e3e-4cb9-9d7a-b0451d4e49b0';
  const getWalletImage = (pack?: typeof activePackages[number]) => pack?.walletImageUrl?.trim() || '';
  const getSecureImage = (pack?: typeof activePackages[number]) => pack?.secureImageUrl?.trim() || '';
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
  const getTierStyles = (index: number) => {
    switch (index) {
      case 0:
        return 'opacity-90 border-white/10';
      case 1:
        return 'border-white/20 hover:scale-[1.02]';
      case 2:
        return 'scale-[1.06] border-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.5)] z-10';
      case 3:
        return 'border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
      case 4:
        return 'bg-gradient-to-br from-purple-900/40 to-black border-purple-400/40';
      case 5:
        return 'bg-gradient-to-br from-yellow-500/20 to-black border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)]';
      default:
        return '';
    }
  };
  const getTierVisualWeight = (index: number) => {
    if (activePackages.length <= 1) return 0;
    return index / (activePackages.length - 1);
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
    <div data-disable-pull-refresh="true" className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden overscroll-none p-2 py-3 sm:p-4 sm:items-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={handleClose}
      ></div>
      
      <div className="relative flex max-h-[96dvh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-violet-500/20 bg-[#060b1a] shadow-2xl shadow-black/60 animate-in zoom-in-95">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex items-start justify-between border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10">
                        {getWalletImage(selectedPackage) ? (
                          <img src={getWalletImage(selectedPackage)} alt="Wallet" className="h-7 w-7 object-contain" />
                        ) : (
                          <Wallet className="h-5 w-5 text-violet-300" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-wide text-white sm:text-4xl">Top Up</h2>
                        <p className="mt-1 text-xs text-gray-400 sm:text-sm">Add coins to your balance instantly</p>
                      </div>
                    </div>
                    <div className="mr-3 hidden items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-gray-200 sm:flex">
                      {getSecureImage(selectedPackage) ? (
                        <img src={getSecureImage(selectedPackage)} alt="100% Secure" className="h-5 w-5 object-contain" />
                      ) : (
                        <Shield className="h-4 w-4 text-emerald-300" />
                      )}
                      <div className="leading-tight">
                        <p className="font-semibold text-white">100% Secure</p>
                        <p className="text-[11px] text-gray-400">Encrypted Payments</p>
                      </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
                    {isPostFreeBoxFlow && (
                      <p className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                        Covers your first box + extra spins
                      </p>
                    )}
                    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-500/15 via-[#2f1f52]/20 to-violet-500/10 px-3 py-3 sm:px-4">
                      <img src={getPackageImage(selectedPackage ?? activePackages[0])} alt="Bonus" className="h-12 w-12 rounded-lg object-contain sm:h-14 sm:w-14" />
                      <div className="flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300 sm:text-xs">First time bonus</p>
                        <p className="text-sm font-semibold text-white sm:text-xl">Get +10% extra coins on your first top up!</p>
                      </div>
                      <button className="hidden rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-900/40 sm:block">
                        Apply Bonus
                      </button>
                    </div>
                    <div className="mb-4 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="min-h-0">
                        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">Select a coin package</label>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                        {activePackages.length === 0 ? (
                          <div className="col-span-full rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-6 text-center text-xs text-gray-500">
                            No packages available right now.
                          </div>
                        ) : (
                          activePackages.map((pack, index) => {
                            const isSelected = selectedPackage?.id === pack.id;
                            const isFocal = index === 2;
                            const tierStyles = getTierStyles(index);
                            const selectedStyles = isSelected
                              ? 'ring-2 ring-emerald-400 scale-[1.08]'
                              : isFocal
                                ? 'scale-[1.06]'
                                : '';
                            const bonusCoins = pack.bonusCoins ?? 0;
                            const bonusLabel = getBonusLabel(pack);
                            const tierWeight = getTierVisualWeight(index);
                            const badgeText = pack.badge?.trim() ?? '';
                            return (
                              <button
                                  key={pack.id}
                                  onClick={() => {
                                    setSelectedPackageId(pack.id);
                                    setHasUserSelectedPackage(true);
                                    playSound('click');
                                  }}
                                  className={`relative rounded-xl border bg-[#10172a] p-2.5 text-left transition-all duration-300
                                    hover:scale-[1.02] hover:shadow-lg hover:brightness-110
                                    ${!isSelected ? getBadgeClasses(pack.badge) : ''}
                                    ${isSelected ? getSelectedClasses(pack.badge) : ''}
                                    ${tierStyles}
                                    ${selectedStyles}
                                    ${isFocal ? 'hover:scale-[1.04]' : ''}`}
                                  style={!isSelected ? { borderColor: `rgba(148, 163, 184, ${0.1 + tierWeight * 0.22})` } : undefined}
                              >
                                  {badgeText && (
                                    <span
                                      className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                        badgeText.toLowerCase().includes('best')
                                          ? 'bg-amber-500 text-black'
                                          : badgeText.toLowerCase().includes('good')
                                            ? 'bg-sky-500 text-black'
                                            : 'bg-zinc-200 text-black'
                                      }`}
                                    >
                                      {badgeText}
                                    </span>
                                  )}
                                  <div className="mb-2 overflow-hidden rounded-lg border border-white/5 bg-black/20 p-2">
                                    <img
                                      src={getPackageImage(pack)}
                                      alt={pack.name}
                                      className="h-16 w-full object-contain sm:h-20"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <CoinAmount
                                      amount={pack.coins}
                                      formatOptions={{ maximumFractionDigits: 0 }}
                                      className="font-black text-lg text-white sm:text-2xl"
                                      iconClassName="h-3 w-3 sm:h-3.5 sm:w-3.5"
                                    />
                                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                      <span className="text-[11px] font-semibold text-gray-300">{pack.name}</span>
                                      {bonusCoins > 0 && bonusLabel && (
                                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                          {bonusLabel}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-center text-lg font-black text-white">
                                      {pack.displayPrice}
                                    </div>
                                  </div>
                              </button>
                            );
                          })
                        )}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-[#0b1326] p-3 sm:p-4">
                        <p className="mb-3 text-lg font-black uppercase text-gray-200">Your Order</p>
                        <div className="space-y-2 text-sm text-gray-300">
                          <div className="flex items-center justify-between"><span>Coins Package</span><span className="font-semibold text-white">{Math.round(selectedPackage?.coins ?? 0).toLocaleString()}</span></div>
                          <div className="flex items-center justify-between"><span>Bonus</span><span className="font-semibold text-emerald-300">+{Math.round(selectedPackage?.bonusCoins ?? 0).toLocaleString()} {getBonusSummaryLabel(selectedPackage)}</span></div>
                          <div className="my-2 h-px bg-white/10"></div>
                          <div className="flex items-center justify-between text-base"><span>You Pay</span><span className="text-2xl font-black text-white">{formattedDepositAmount}</span></div>
                          <div className="rounded-xl bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 p-3 text-center">
                            <p className="text-sm font-semibold text-violet-200">You Receive</p>
                            <CoinAmount amount={totalCoins} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 text-3xl font-black text-white" iconClassName="h-5 w-5" />
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#0d162d] p-3 text-xs">
                          <div className="flex items-center gap-2 text-gray-200"><Sparkles className="h-3.5 w-3.5 text-cyan-300" />Instant Delivery</div>
                          <div className="flex items-center gap-2 text-gray-200"><Lock className="h-3.5 w-3.5 text-violet-300" />Secure Payment</div>
                          <div className="flex items-center gap-2 text-gray-200"><Shield className="h-3.5 w-3.5 text-fuchsia-300" />Best Prices</div>
                        </div>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                        {errorMessage}
                      </div>
                    )}

                </div>
                <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#10131c]/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
                  <button
                    onClick={handleDeposit}
                    disabled={isLoading || !selectedPackage}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-lg shadow-violet-900/30 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Continue to Payment
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                  {effectiveRate ? (
                    <p className="mt-2 text-center text-[10px] text-cyan-300">≈ {effectiveRate.toLocaleString()} coins per $1</p>
                  ) : null}
                  <p className="mt-1 text-center text-[10px] text-gray-500">
                    By depositing you agree to our Terms of Service.
                  </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
