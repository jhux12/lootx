import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, CheckCircle, Sparkles, Crown, Gift, Zap, ShieldCheck, Package, LockKeyhole } from 'lucide-react';
import { getStripe } from '../utils/stripeClient';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { auth } from '../firebase';
import { PaymentMethodIcons } from './PaymentMethodIcons';
import { readCookieValue, trackMetaEvent } from '../utils/trackEvent';
import { hasUserMadeDeposit } from '../utils/depositEligibility';
import { lockPageScroll } from '../utils/scrollLock';
import { getAttribution, getGaClientId, trackBeginCheckout, trackCoinPackageSelect, trackCoinPackageView, trackEvent as trackGaEvent } from '../services/analytics';
import { savePendingCheckout } from '../services/checkoutTracking';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const COMMUNITY_PULL_FALLBACK_IMAGES = [
  'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/live-community-submissions%2Fhpu7GXqOSdULbP9bzbesU809a4F2-1784085781459-screenshot-2026-07-14-230848.png?alt=media&token=7cc76521-2284-487f-9298-2178db573f49',
  'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/Stories%2FScreenshot%202026-05-29%20at%205.07.00%E2%80%AFPM.png?alt=media&token=8225097c-81b3-40b9-a2e8-8473a14027a9',
  'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/heroimg%2FScreenshot%202026-07-21%20at%204.33.37%E2%80%AFPM.png?alt=media&token=7f5f05c9-8fbb-441f-9016-aa156b7edb95',
  'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/live-community%2F1779746774126-screenshot-2026-05-25-at-6.04.59-pm.png?alt=media&token=b594ddd1-228a-4c24-86b5-1129c6b1abb9'
];

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
  const [communityPullImages, setCommunityPullImages] = useState<string[]>(COMMUNITY_PULL_FALLBACK_IMAGES);
  const autoSelectAppliedRef = React.useRef(false);
  const postFreeOfferAutoShownRef = React.useRef(false);
  const modalTrackingIdRef = React.useRef(`topup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const isPostFreeBoxFlow = topUpModalIntent?.source === 'post_free_box';

  React.useEffect(() => {
    if (!isPostFreeBoxFlow) return undefined;

    const communityQuery = query(collection(db, 'liveCommunityStories'), where('approved', '==', true), limit(12));
    return onSnapshot(communityQuery, (snapshot) => {
      const images = snapshot.docs
        .map((entry) => entry.data() as { hidden?: boolean; mediaType?: string; mediaUrl?: string; featured?: boolean; order?: number })
        .filter((story) => !story.hidden && story.mediaType !== 'video' && Boolean(story.mediaUrl))
        .sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return Number(a.order ?? 9999) - Number(b.order ?? 9999);
        })
        .map((story) => story.mediaUrl as string)
        .slice(0, 4);
      if (images.length) setCommunityPullImages(images);
    }, () => {
      // The curated fallback set keeps this trust proof visible if live stories are unavailable.
    });
  }, [isPostFreeBoxFlow]);
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

  React.useEffect(() => {
    if (!coinPackagesLoaded || displayedPackages.length === 0) return;
    trackCoinPackageView({
      currency: 'USD',
      checkout_source: topUpModalIntent?.source ?? 'top_up_modal',
      is_first_deposit_offer: Boolean(isFirstDepositEligible && showFirstDepositPackages),
      items: displayedPackages.map((pack) => ({
        item_id: pack.id,
        item_name: pack.name || pack.id,
        item_category: 'coin_package',
        price: parseDisplayPrice(pack.displayPrice),
        quantity: 1
      }))
    }, `${modalTrackingIdRef.current}:${showFirstDepositPackages ? 'first_deposit' : 'standard'}`);
  }, [coinPackagesLoaded, displayedPackages, isFirstDepositEligible, showFirstDepositPackages, topUpModalIntent?.source]);

  const renderPackageCard = (pack: typeof displayedPackages[number]) => {
    const isSelected = selectedPackage?.id === pack.id;
    const bonusCoins = pack.bonusCoins ?? 0;
    const baseCoins = Math.max(0, Number(pack.coins ?? 0));
    const bonusPercent = baseCoins > 0 ? Math.round((bonusCoins / baseCoins) * 100) : 0;
    const badgeText = pack.badge?.trim() ?? '';

    return (
      <button
        key={pack.id}
        onClick={() => {
          setSelectedPackageId(pack.id);
          setHasUserSelectedPackage(true);
          trackCoinPackageSelect({
            currency: 'USD',
            value: parseDisplayPrice(pack.displayPrice),
            package_id: pack.id,
            coin_amount: Number(pack.coins ?? 0),
            bonus_coin_amount: Number(pack.bonusCoins ?? 0),
            checkout_source: topUpModalIntent?.source ?? 'top_up_modal',
            items: [{
              item_id: pack.id,
              item_name: pack.name || pack.id,
              item_category: 'coin_package',
              price: parseDisplayPrice(pack.displayPrice),
              quantity: 1
            }]
          }, `${modalTrackingIdRef.current}:${pack.id}`);
          playSound('click');
        }}
        aria-pressed={isSelected}
        className={`relative flex min-h-[118px] w-full items-center gap-3 rounded-2xl border bg-[linear-gradient(105deg,rgba(255,255,255,.055),rgba(255,255,255,.012))] px-4 py-4 text-left transition-all duration-200 sm:min-h-[148px] sm:gap-5 sm:px-7 sm:py-5
          ${isSelected ? 'border-[#ffc746] shadow-[inset_0_0_0_1px_rgba(255,199,70,.55),0_0_22px_rgba(255,185,40,.22)]' : 'border-white/20 hover:border-white/35 hover:bg-white/[.055]'}`}
      >
        {badgeText && (
            <span
              className={`absolute left-4 top-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wide sm:left-9 sm:top-5 sm:px-5 sm:text-xs ${isSelected ? 'bg-[#ffc746] text-[#17140c]' : getBadgeClasses(pack.badge)}`}
            >
              <Crown className="h-3 w-3" /> {badgeText}
            </span>
        )}
        <img src={getPackageImage(pack)} alt="" className={`h-14 w-14 shrink-0 object-contain sm:h-[70px] sm:w-[70px] ${badgeText ? 'mt-5 sm:mt-6' : ''}`} />
        <div className={`min-w-0 flex-1 ${badgeText ? 'mt-5 sm:mt-6' : ''}`}>
          <div className="truncate text-xl font-black tracking-tight text-white sm:text-[34px]">{baseCoins.toLocaleString()} Coins</div>
          {bonusCoins > 0 && <div className="mt-0.5 text-sm font-extrabold text-[#ffc746] sm:text-lg">+{bonusCoins.toLocaleString()} bonus</div>}
          {bonusPercent > 0 && (
            <span className="mt-2 hidden w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3 py-1 text-xs font-medium text-white/65 sm:flex">
              <Gift className="h-4 w-4" /> Includes {bonusPercent}% bonus
            </span>
          )}
        </div>
        <span className={`shrink-0 text-xl font-black text-white sm:text-[32px] ${badgeText ? 'mt-5 sm:mt-6' : ''}`}>{pack.displayPrice.replace('.00', '')}</span>
        <span className={`absolute right-4 top-3 h-6 w-6 rounded-full border-2 sm:right-5 sm:top-5 sm:h-8 sm:w-8 ${isSelected ? 'border-[#ffc746] shadow-[0_0_12px_rgba(255,199,70,.55)]' : 'border-white/30'}`}>
          {isSelected && <CheckCircle className="-m-[2px] h-6 w-6 text-[#ffc746] sm:h-8 sm:w-8" />}
        </span>
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
    if (!isPostFreeBoxFlow) {
      postFreeOfferAutoShownRef.current = false;
      return;
    }

    // Open the matching offers when this flow first starts, but let customers
    // switch back to standard packages without immediately toggling it on again.
    if (!postFreeOfferAutoShownRef.current) {
      postFreeOfferAutoShownRef.current = true;
      setShowFirstDepositPackages(true);
      return;
    }
    if (!showFirstDepositPackages) return;
    if (displayedPackages.length === 0) return;

    const preferredUsd = Number(topUpModalIntent?.preferredPackageUsd ?? 50);
    const preferredPackage = displayedPackages.find((pkg) => Math.abs(parseDisplayPrice(pkg.displayPrice) - preferredUsd) < 0.001);
    if (!preferredPackage) return;
    setRecommendedPackageId(preferredPackage.id);
    setSelectedPackageId(preferredPackage.id);
    setHasUserSelectedPackage(false);
    autoSelectAppliedRef.current = true;
  }, [displayedPackages, isPostFreeBoxFlow, showFirstDepositPackages, topUpModalIntent?.preferredPackageUsd]);

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

      const eventId = generateCheckoutEventId();
      let checkoutSessionId = '';
      let failureStage = 'session_creation';

      try {
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
          checkoutSessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
          if (!checkoutSessionId) {
            throw new Error('Checkout session was not returned.');
          }
          savePendingCheckout({
            sessionId: checkoutSessionId,
            packageId: selectedPackage.id,
            value: priceValue,
            currency: 'USD',
            source: topUpModalIntent?.source ?? 'top_up_modal',
            startedAt: Date.now()
          });
          trackBeginCheckout({ currency: 'USD', value: priceValue, payment_type: 'stripe', items: [{ item_id: selectedPackage.id, item_name: selectedPackage.name || selectedPackage.id, item_category: 'coin_package', price: priceValue, quantity: 1 }], coin_amount: Number(selectedPackage.coins ?? 0), bonus_coin_amount: Number(selectedPackage.bonusCoins ?? 0), package_id: selectedPackage.id, checkout_session_id: data.sessionId, is_first_deposit_intent: isFirstDepositEligible, checkout_source: topUpModalIntent?.source ?? 'top_up_modal', missing_coins: isInsufficientBalanceFlow ? missingCoins : undefined }, data.sessionId);
          if (topUpModalIntent?.source === 'post_free_box') {
            trackGaEvent('free_box_to_checkout', { package_id: selectedPackage.id, checkout_session_id: data.sessionId }, data.sessionId);
          }
          failureStage = 'stripe_initialization';
          const stripe = await getStripe();
          if (!stripe) {
            throw new Error('Stripe failed to initialize.');
          }
          failureStage = 'stripe_redirect';
          const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (result.error) {
            throw result.error;
          }
      } catch (error: unknown) {
          trackGaEvent('checkout_failed', {
            failure_stage: failureStage,
            package_id: selectedPackage.id,
            checkout_session_id: checkoutSessionId || undefined,
            currency: 'USD',
            value: priceValue,
            checkout_source: topUpModalIntent?.source ?? 'top_up_modal'
          }, checkoutSessionId || eventId);
          setErrorMessage(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
          setIsLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center overflow-hidden sm:items-center sm:p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={handleClose}
      ></div>
      
      <div className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top))] min-h-0 w-full max-w-[760px] flex-col overflow-hidden rounded-t-[26px] border border-white/15 bg-[radial-gradient(circle_at_50%_25%,#1d2428_0%,#12181d_52%,#10161a_100%)] shadow-[0_24px_90px_rgba(0,0,0,.75)] animate-in zoom-in-95 sm:max-h-[min(900px,calc(100dvh-2rem))] sm:rounded-[28px]">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 sm:px-8 sm:py-6">
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/15 sm:h-16 sm:w-16">
                        <Wallet className="h-6 w-6 text-[#ffc746] sm:h-8 sm:w-8" />
                      </div>
                      <h2 className="text-2xl font-black tracking-tight text-white sm:text-[34px]">Add Coins</h2>
                    </div>
                    <button 
                        onClick={handleClose} 
                        aria-label="Close add coins"
                        className="rounded-2xl border border-white/15 p-2.5 text-white/55 transition-colors hover:bg-white/5 hover:text-white sm:p-4"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:px-8 sm:py-5">
                    {isPostFreeBoxFlow && (
                      <div className="mb-3 rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(255,255,255,0.025))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" aria-label="Real cards shipped to customers">
                        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white sm:text-xs">Real cards shipped to customers</span>
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-emerald-300">Community pulls</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                          {communityPullImages.map((image, index) => (
                            <div key={`${image}-${index}`} className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-[#0d1118] shadow-sm">
                              <img src={image} alt={`Customer card pull ${index + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                            </div>
                          ))}
                        </div>
                      </div>
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
                        className={`mb-5 flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-all sm:px-5 sm:py-4 ${
                          showFirstDepositPackages
                            ? 'border-amber-300/60 bg-[linear-gradient(135deg,rgba(247,183,51,0.22),rgba(124,92,255,0.18))] shadow-[0_0_24px_rgba(247,183,51,0.16)]'
                            : 'border-white/10 bg-white/[0.04] hover:border-amber-300/35 hover:bg-white/[0.07]'
                        }`}
                        aria-pressed={showFirstDepositPackages}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-[#ffd35d] sm:h-14 sm:w-14">
                            <Sparkles className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-extrabold text-white sm:text-lg">First time deposit offers</span>
                          </span>
                        </span>
                        <span className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${showFirstDepositPackages ? 'bg-amber-300' : 'bg-slate-700'}`}>
                          <span className={`block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${showFirstDepositPackages ? 'translate-x-5' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    )}
                    {/* Amount Selector */}
                    <label className="mb-3 block text-sm font-black uppercase tracking-wide text-slate-200 sm:text-lg">Select a pack</label>
                    <div className="mb-4">
                    <div className="flex flex-col gap-3 sm:gap-4">
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
                <div className="shrink-0 border-t border-white/10 bg-[#11171b]/95 px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8 sm:py-5">
                  <button
                    onClick={handleDeposit}
                    disabled={isLoading || isInitialPackagesLoading || !selectedPackage}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7547ff,#06dcea)] px-2 text-base font-black text-white shadow-[0_10px_30px_rgba(39,172,255,.18)] transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:h-[70px] sm:text-[26px]"
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
                  <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/75 sm:mt-4 sm:gap-4 sm:text-sm">
                    <span className="flex items-center gap-1 text-nowrap"><Zap className="h-4 w-4 text-[#ffc746]" /> Use coins instantly</span><span className="text-[#ffc746]">•</span>
                    <span className="flex items-center gap-1 text-nowrap"><ShieldCheck className="h-4 w-4 text-[#ffc746]" /> Keep or sell pulls</span><span className="hidden text-[#ffc746] sm:inline">•</span>
                    <span className="hidden items-center gap-1 text-nowrap sm:flex"><Package className="h-4 w-4 text-[#ffc746]" /> Real items ship to you</span>
                  </div>
                  <div className="mt-3 rounded-xl bg-white/[.035] px-2 py-2 sm:px-4"><PaymentMethodIcons className="gap-1.5 opacity-90 sm:flex-nowrap sm:gap-3" iconClassName="h-4 sm:h-8" /></div>
                  <p className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] text-white/50 sm:text-sm"><LockKeyhole className="h-3.5 w-3.5" /> Secure checkout <span>•</span> Instant delivery</p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
