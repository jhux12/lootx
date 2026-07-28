import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CheckCircle2, ChevronLeft, ChevronRight, Coins, CreditCard, Flame, Gift, RefreshCw, ShieldCheck, Sparkles, Truck, Zap } from 'lucide-react';
import { HowItWorksSection } from './HowItWorksSection';
import { HomepageFaqSection } from './HomepageFaqSection';
import { Timestamp, addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { COIN_ICON } from '../constants';
import { useAuth, useUI } from '../context/GameContext';
import { getConfiguredHomepageSummaries, getHomepageSummaries, invalidateHomepageSummaries } from '../utils/boxRepository';
import { getHomepageWins, HomepageWin } from '../utils/recentWinsRepository';
import { usePerformanceMode } from '../src/lib/performance';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

type HomeReplicaProps = {
  demoBoxId?: string | null;
  trendingBoxIds?: string[];
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

type MobileLiveWin = {
  id: string;
  title: string;
  image: string;
  rarity: MysteryBox['items'][number]['rarity'];
  timeAgo: string;
  boxId: string;
};

type MobileCustomerReview = {
  id: string;
  username: string;
  caption: string;
  mediaUrl: string;
  timestampLabel?: string;
  order?: number;
  featured?: boolean;
};

const MOBILE_LIVE_WIN_ACCENT: Record<MobileLiveWin['rarity'], string> = {
  common: 'from-slate-700/95 via-slate-800/95 to-slate-950/95',
  uncommon: 'from-emerald-900/95 via-emerald-950/90 to-slate-950/95',
  rare: 'from-sky-900/95 via-blue-950/90 to-slate-950/95',
  epic: 'from-violet-900/95 via-purple-950/90 to-slate-950/95',
  legendary: 'from-yellow-400/90 via-amber-600/90 to-yellow-950/95'
};

const MOBILE_REVIEW_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1613771404721-1f92d799e49f?auto=format&fit=crop&w=700&q=75';
const MOBILE_DEPOSIT_MATCH_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/svg%2FUntitled%20(500%20x%20333%20px).png?alt=media&token=a0cdd2c8-d68c-4ed4-9a82-c5b5338b3a8f';
const PROMO_BOX_ID = 'Pix6KvQzz8C9GtQf7F72';

const MobileLiveWinCard: React.FC<{ win: MobileLiveWin; onOpenBox: (boxId: string) => void }> = ({ win, onOpenBox }) => (
  <button type="button" onClick={() => onOpenBox(win.boxId)} className={`relative h-[128px] min-w-[100px] overflow-hidden rounded-md bg-gradient-to-br ${MOBILE_LIVE_WIN_ACCENT[win.rarity]} p-2 text-left shadow-[0_14px_28px_rgba(0,0,0,0.30)] active:scale-[0.98]`} aria-label={`Open box for ${win.rarity} live win`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.12),transparent_18%),linear-gradient(180deg,transparent_48%,rgba(0,0,0,0.28))]" />
    {win.image ? <img src={win.image} alt="" width={96} height={96} decoding="async" className="absolute inset-x-0 bottom-2 top-3 z-10 mx-auto h-[96px] w-[96px] object-contain drop-shadow-[0_13px_16px_rgba(0,0,0,0.42)]" loading="lazy" /> : null}
    <div className="absolute bottom-2 left-2 z-30 rounded bg-black/20 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.rarity}</div>
    <div className="absolute bottom-2 right-2 z-30 rounded bg-white/18 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.timeAgo}</div>
  </button>
);


const MobileCustomerReviewCard: React.FC<{ story: MobileCustomerReview }> = ({ story }) => {
  const initial = (story.username || 'P').trim().charAt(0).toUpperCase();
  return (
    <article className="w-[168px] shrink-0 overflow-hidden rounded-2xl border border-[#8b5cf6]/20 bg-[#101827] p-1.5 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:w-[196px]">
      <div className="relative aspect-[1.35] w-full overflow-hidden rounded-[1rem] bg-[#141829]">
        <img src={story.mediaUrl} alt={`${story.username || 'Customer'} Pullz review`} className="h-full w-full object-cover" loading="lazy" decoding="async" width={196} height={145} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-[#202337]/90 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" aria-hidden="true" />
          Hit proof
        </div>
      </div>
      <div className="flex items-center gap-2 px-1.5 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-300 to-purple-500 text-xs font-black text-white ring-2 ring-[#8b5cf6]/35">{initial}</div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-black text-white">{story.username || 'Pullz customer'}</div>
          <div className="truncate text-[11px] font-bold text-slate-400">{story.timestampLabel || 'recently'}</div>
        </div>
      </div>
    </article>
  );
};

const MobileCustomerReviewSkeleton: React.FC = () => (
  <div className="w-[168px] shrink-0 animate-pulse overflow-hidden rounded-2xl border border-[#8b5cf6]/20 bg-[#101827] p-1.5 sm:w-[196px]" aria-hidden="true">
    <div className="aspect-[1.35] rounded-[1rem] bg-[#242b31]" />
    <div className="flex items-center gap-2 px-1.5 py-2">
      <div className="h-8 w-8 rounded-full bg-[#242b31]" />
      <div className="space-y-2">
        <div className="h-3 w-20 rounded bg-[#242b31]" />
        <div className="h-2.5 w-14 rounded bg-[#242b31]" />
      </div>
    </div>
  </div>
);

const FreeBoxHeroSlide: React.FC<{ box: MysteryBox }> = ({ box }) => (
  <div className="relative h-full w-full shrink-0 overflow-hidden bg-[linear-gradient(120deg,#5525cf_0%,#5146dd_52%,#4275e8_100%)] px-5 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,.14),transparent_28%),radial-gradient(circle_at_88%_75%,rgba(152,90,255,.40),transparent_46%)]" />
    <div className="relative z-10 grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-6">
      <div className="min-w-0">
        <p className="inline-flex rounded-full bg-[#3b278f]/55 px-3 py-1 text-[9px] font-black uppercase tracking-[.08em] text-white shadow-sm sm:text-[11px]">New user bonus</p>
        <h1 className="mt-2 max-w-[285px] text-[24px] font-black uppercase leading-[.92] tracking-[-.04em] text-white sm:max-w-[440px] sm:text-[38px] lg:max-w-[590px] lg:text-[58px]">Your Free Box Is Ready</h1>
        <span className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#5428c9] shadow-[0_8px_20px_rgba(0,0,0,.16)] sm:px-4 sm:text-xs">Open now</span>
      </div>
      {box.image ? <img src={box.image} alt={box.name} className="h-24 w-24 self-center object-contain drop-shadow-[0_18px_25px_rgba(0,0,0,.42)] sm:h-36 sm:w-36 lg:h-48 lg:w-48" /> : null}
    </div>
  </div>
);

const PromoBoxHeroSlide: React.FC<{ box: MysteryBox }> = ({ box }) => (
  <div className="relative h-full w-full shrink-0 overflow-hidden bg-[linear-gradient(118deg,#070d0d_0%,#172420_48%,#17110d_100%)] px-5 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(41,217,203,.22),transparent_27%),radial-gradient(circle_at_86%_85%,rgba(255,169,55,.24),transparent_35%),linear-gradient(90deg,rgba(112,39,146,.20),transparent_46%)]" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-[linear-gradient(90deg,transparent,rgba(255,188,75,.48),transparent)] blur-md" />
    <div className="relative z-10 flex h-full items-center justify-center text-center">
      {box.image ? <img src={box.image} alt="" aria-hidden="true" width={500} height={500} fetchPriority="high" decoding="async" className="pointer-events-none absolute left-0 top-1/2 h-20 w-20 -translate-y-1/2 object-contain opacity-95 drop-shadow-[0_0_20px_rgba(45,234,217,.25)] drop-shadow-[0_18px_25px_rgba(0,0,0,.62)] sm:-left-1 sm:h-28 sm:w-28 lg:left-3 lg:h-36 lg:w-36" /> : null}
      <div className="relative z-10 flex min-w-0 max-w-[180px] flex-col items-center sm:max-w-[420px] lg:max-w-[590px]">
        <h1 className="text-[21px] font-black uppercase leading-[.9] tracking-[-.04em] text-[#fff6dc] drop-shadow-[0_3px_0_rgba(76,35,15,.7)] sm:text-[30px] lg:text-[48px]"><span className="text-amber-300">Promo Box</span> just dropped</h1>
        <p className="mt-1.5 hidden text-[11px] font-bold uppercase leading-tight tracking-[.08em] text-teal-100/80 sm:block lg:text-sm">Enter the vault and uncover a special pull.</p>
        <span className="mt-2 inline-flex rounded-xl border border-amber-100/60 bg-[linear-gradient(135deg,#ffdb77,#c87920)] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#241108] shadow-[0_8px_20px_rgba(0,0,0,.35)] sm:px-4 sm:text-xs">Open now</span>
      </div>
      {box.image ? <img src={box.image} alt={box.name} width={500} height={500} fetchPriority="high" decoding="async" className="pointer-events-none absolute right-0 top-1/2 h-20 w-20 -translate-y-1/2 object-contain opacity-95 drop-shadow-[0_0_20px_rgba(45,234,217,.25)] drop-shadow-[0_18px_25px_rgba(0,0,0,.62)] sm:-right-1 sm:h-28 sm:w-28 lg:right-3 lg:h-36 lg:w-36" /> : null}
    </div>
  </div>
);

const MobileSubmitReviewCard: React.FC<{ onSubmit: () => void }> = ({ onSubmit }) => (
  <button
    type="button"
    onClick={onSubmit}
    className="flex w-[168px] shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-[#8b5cf6]/55 bg-[#202337]/78 p-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.18)] active:scale-[0.98] sm:w-[196px]"
  >
    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#8b5cf6]/15 text-2xl">＋</div>
    <h3 className="mt-2 text-sm font-black uppercase text-white">Submit Yours</h3>
    <p className="mt-1 text-[11px] font-bold leading-4 text-slate-300">Share a pull for a chance to be featured.</p>
  </button>
);

const MobileLiveWins = React.memo(({ wins, isLoading, onOpenBox }: { wins: MobileLiveWin[]; isLoading: boolean; onOpenBox: (boxId: string) => void }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const displayedWins = wins.slice(0, 6);

  return (
    <section ref={sectionRef} id="mobile-live-wins" className="pullz-home-live-wins scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Live Wins</h2></div>
        <div className="flex gap-2"><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-500"><ChevronLeft className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-400"><ChevronRight className="h-4 w-4" /></button></div>
      </div>
      <div className="overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory [scrollbar-width:none]">
        <div className="flex w-max gap-2 pb-1">
          {displayedWins.map((win) => <div className="snap-start" key={win.id}><MobileLiveWinCard win={win} onOpenBox={onOpenBox} /></div>)}
          {!displayedWins.length && isLoading ? Array.from({ length: 6 }).map((_, index) => <div key={`live-win-loading-${index}`} className="h-[128px] min-w-[100px] animate-pulse rounded-md bg-[#242b31]" aria-hidden="true" />) : null}
          {!displayedWins.length && !isLoading ? <p className="py-8 text-sm font-semibold text-slate-400">Live wins will appear here soon.</p> : null}
        </div>
      </div>
    </section>
  );
});
MobileLiveWins.displayName = 'MobileLiveWins';

const MobileHomePreview = ({ boxes, freeSignupBox, promoBox, trendingBoxIds, onOpenBox, onViewAllBoxes }: { boxes: MysteryBox[]; freeSignupBox?: MysteryBox | null; promoBox?: MysteryBox | null; trendingBoxIds: string[]; onOpenBox: (boxId: string, isFree?: boolean) => void; onViewAllBoxes: () => void }) => {
  const { isAuthenticated, openAuthModal, user } = useAuth();
  const { setShowTopUpModal, setTopUpModalIntent } = useUI();
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const heroTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const performanceMode = usePerformanceMode();
  const [customerReviews, setCustomerReviews] = useState<MobileCustomerReview[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [submitReviewFile, setSubmitReviewFile] = useState<File | null>(null);
  const [submitReviewCaption, setSubmitReviewCaption] = useState('');
  const [submitReviewNotice, setSubmitReviewNotice] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [homepageWins, setHomepageWins] = useState<HomepageWin[]>([]);
  const [isLiveWinsLoading, setIsLiveWinsLoading] = useState(true);
  const trendingBoxes = useMemo(() => {
    return trendingBoxIds
      .map((id) => boxes.find((box) => box.id === id))
      .filter(Boolean) as MysteryBox[];
  }, [boxes, trendingBoxIds]);
  const mobileLiveWins = useMemo<MobileLiveWin[]>(() => {
    const now = Date.now();
    return homepageWins.map((win) => ({ id: win.id, title: win.itemName, image: win.itemImage, rarity: win.rarity, timeAgo: win.timestamp ? `${Math.max(1, Math.floor((now - win.timestamp.getTime()) / 60000))}m` : 'recent', boxId: win.boxId }));
  }, [homepageWins]);

  useEffect(() => {
    let cancelled = false;
    setIsLiveWinsLoading(true);

    void getHomepageWins()
      .then((wins) => { if (!cancelled) setHomepageWins(wins); })
      .catch(() => {
        if (!cancelled) setHomepageWins([]);
      })
      .finally(() => {
        if (!cancelled) setIsLiveWinsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);
  const customerReviewCards = customerReviews.length
    ? customerReviews
    : [{ id: 'fallback-review', username: 'edb87', caption: '', mediaUrl: MOBILE_REVIEW_FALLBACK_IMAGE, timestampLabel: '11/20/2025' }];

  useEffect(() => {
    const element = heroSectionRef.current;
    if (!element || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setIsHeroVisible(entry?.isIntersecting ?? false), { threshold: 0.05 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);


  const showFreeBoxSlide = isAuthenticated && Boolean(freeSignupBox) && !user.lastFreeBoxClaim;

  useEffect(() => {
    if (showFreeBoxSlide || promoBox) setActiveHeroSlide(0);
  }, [promoBox, showFreeBoxSlide]);

  useEffect(() => {
    if (showFreeBoxSlide || !isHeroVisible || performanceMode.isHidden || performanceMode.prefersReducedMotion || performanceMode.isLowPower) return undefined;
    const heroTimer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 10000);
    return () => window.clearInterval(heroTimer);
  }, [isHeroVisible, performanceMode.isHidden, performanceMode.isLowPower, performanceMode.prefersReducedMotion, showFreeBoxSlide]);

  useEffect(() => {
    let cancelled = false;
    const loadReviews = async () => {
      if (cancelled) return;
      const reviewsQuery = query(collection(db, 'liveCommunityStories'), where('approved', '==', true), limit(12));
      try {
      const snapshot = await getDocs(reviewsQuery);
      if (cancelled) return;
      const nextReviews = snapshot.docs
        .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<MobileCustomerReview, 'id'> & { hidden?: boolean; mediaUrl?: string }) }))
        .filter((story) => !story.hidden && Boolean(story.mediaUrl))
        .sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return Number(a.order ?? 9999) - Number(b.order ?? 9999);
        })
        .slice(0, 6)
        .map((story) => ({
          id: story.id,
          username: String(story.username || 'Pullz customer'),
          caption: String(story.caption || ''),
          mediaUrl: String(story.mediaUrl || ''),
          timestampLabel: story.timestampLabel ? String(story.timestampLabel) : 'recently',
          order: Number(story.order ?? 9999),
          featured: Boolean(story.featured)
        }));
      setCustomerReviews(nextReviews);
      setIsReviewsLoading(false);
      } catch {
        if (cancelled) return;
        setCustomerReviews([]);
        setIsReviewsLoading(false);
      }
    };

    const reviewsSection = document.getElementById('mobile-customer-reviews');
    if (!reviewsSection || !('IntersectionObserver' in window)) {
      const timer = window.setTimeout(loadReviews, 1800);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadReviews();
      }
    }, { rootMargin: '450px 0px' });
    observer.observe(reviewsSection);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const heroSlides = [...(showFreeBoxSlide ? ['free-box'] : []), ...(promoBox ? ['promo-box'] : []), 'deposit-match', 'hot-picks'];
  const activeHero = heroSlides[activeHeroSlide];
  const showFreeBoxHero = activeHero === 'free-box';
  const showPromoBoxHero = activeHero === 'promo-box';
  const showDepositSlide = activeHero === 'deposit-match';

  const goToHeroSlide = (direction: 1 | -1) => {
    setActiveHeroSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  };

  const handleHeroTouchStart = (event: React.TouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    heroTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleHeroTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
    const start = heroTouchStartRef.current;
    heroTouchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    goToHeroSlide(deltaX < 0 ? 1 : -1);
  };

  const handleHeroAction = () => {
    if (showFreeBoxHero && freeSignupBox) {
      onOpenBox(freeSignupBox.id, true);
      return;
    }
    if (showPromoBoxHero && promoBox) {
      onOpenBox(promoBox.id);
      return;
    }
    if (showDepositSlide) {
      if (!isAuthenticated) {
        openAuthModal('login');
        return;
      }

      setTopUpModalIntent({
        reason: 'insufficient_balance',
        requiredCoins: 10000,
        currentBalance: Number(user.balance ?? 0),
        missingCoins: Math.max(0, 10000 - Number(user.balance ?? 0)),
        preferredPackageUsd: 50
      });
      setShowTopUpModal(true);
      return;
    }

    onViewAllBoxes();
  };

  const handleSubmitReview = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setIsSubmitReviewOpen(true);
  };

  const handleSubmitReviewUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!submitReviewFile) {
      setSubmitReviewNotice('Add a photo before submitting.');
      return;
    }
    if (!submitReviewFile.type.startsWith('image/')) {
      setSubmitReviewNotice('Please upload an image file.');
      return;
    }
    setIsSubmittingReview(true);
    setSubmitReviewNotice(null);
    try {
      const [{ storage }, { getDownloadURL, ref, uploadBytes }] = await Promise.all([
        import('../firebaseStorage'),
        import('firebase/storage')
      ]);
      const safeName = submitReviewFile.name.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
      const uploadRef = ref(storage, `live-community-submissions/${user.id}-${Date.now()}-${safeName}`);
      await uploadBytes(uploadRef, submitReviewFile, { contentType: submitReviewFile.type || 'image/jpeg' });
      const mediaUrl = await getDownloadURL(uploadRef);
      await addDoc(collection(db, 'liveCommunityStories'), {
        username: user.username || user.displayName || user.name || user.email?.split('@')[0] || 'Pullz customer',
        caption: submitReviewCaption.trim() || 'Customer review',
        mediaUrl,
        mediaType: 'image',
        type: 'community setups',
        rarity: 'rare',
        source: 'community-submit-pull',
        submittedByUserId: user.id,
        submittedByEmail: user.email ?? null,
        approved: false,
        status: 'pending',
        hidden: true,
        featured: false,
        showViewCount: true,
        badgeText: 'Customer review',
        timestampLabel: new Date().toLocaleDateString(),
        createdAt: serverTimestamp(),
        publishAt: Timestamp.fromMillis(Date.now()),
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
        order: 9999,
        views: 0,
        clicks: 0
      });
      setSubmitReviewFile(null);
      setSubmitReviewCaption('');
      setSubmitReviewNotice('Submitted! We will review it before publishing.');
    } catch (error) {
      setSubmitReviewNotice(error instanceof Error ? error.message : 'Unable to submit right now.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <section ref={heroSectionRef} className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-4 lg:px-6">
        <button type="button" onClick={handleHeroAction} onTouchStart={handleHeroTouchStart} onTouchEnd={handleHeroTouchEnd} className="pullz-home-hero relative mx-auto h-[132px] w-full max-w-[1180px] overflow-hidden rounded-[1.28rem] text-left shadow-[0_18px_34px_rgba(0,0,0,0.24)] active:scale-[0.99] sm:h-[164px] sm:rounded-[1.6rem] lg:h-[220px] lg:rounded-[2rem]">
          <div className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translate3d(-${activeHeroSlide * 100}%,0,0)` }}>
            {showFreeBoxSlide && freeSignupBox && <FreeBoxHeroSlide box={freeSignupBox} />}
            {promoBox && <PromoBoxHeroSlide box={promoBox} />}
            <div className="relative h-full w-full shrink-0 overflow-hidden bg-[linear-gradient(135deg,#6225ef_0%,#4f7ff4_100%)] p-3 sm:p-5 lg:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.20),transparent_32%),radial-gradient(circle_at_50%_118%,rgba(139,92,246,0.22),transparent_38%)]" />
              {showDepositSlide && isHeroVisible && !performanceMode.isHidden && !performanceMode.prefersReducedMotion && !performanceMode.isLowPower && !performanceMode.isMobile ? <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((coinIndex) => (
                  <Coins
                    key={`hero-raining-coin-${coinIndex}`}
                    className="absolute h-5 w-5 animate-[hero-coin-rain_5.8s_linear_infinite] text-amber-300/80 drop-shadow-[0_8px_12px_rgba(0,0,0,0.26)] sm:h-7 sm:w-7 lg:h-10 lg:w-10"
                    style={{
                      left: `${8 + ((coinIndex * 8) % 86)}%`,
                      animationDelay: `${coinIndex * -0.45}s`,
                      animationDuration: `${5.2 + (coinIndex % 4) * 0.55}s`,
                      transform: `rotate(${coinIndex * 23}deg)`
                    }}
                  />
                ))}
              </div> : null}
              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] sm:px-3 sm:text-[10px] lg:text-xs"><Sparkles className="h-3 w-3 lg:h-4 lg:w-4" />50% deposit match</div>
                <h1 className="mt-2 max-w-[270px] text-[21px] font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.26)] sm:max-w-[560px] sm:text-[34px] lg:max-w-[880px] lg:text-[58px]">Get a 50% Bonus on Your First Deposit</h1>
              </div>
              <style>{`@keyframes hero-coin-rain { 0% { transform: translate3d(0,-140%,0) rotate(0deg); opacity: 0; } 12% { opacity: .9; } 82% { opacity: .78; } 100% { transform: translate3d(18px,260px,0) rotate(320deg); opacity: 0; } }`}</style>
            </div>
            <div className="relative h-full w-full shrink-0 overflow-hidden bg-[linear-gradient(135deg,#6225ef_0%,#4f7ff4_100%)] p-3 sm:p-5 lg:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_48%_118%,rgba(139,92,246,0.22),transparent_36%)]" />
              <div className="relative z-10 flex h-full max-w-[55%] flex-col justify-center sm:max-w-[58%] lg:max-w-[56%]">
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-white sm:px-3 sm:text-[10px] lg:text-xs"><Flame className="h-3 w-3 lg:h-4 lg:w-4" />Trending boxes</div>
                <h1 className="mt-2 max-w-[180px] text-[18px] font-black uppercase leading-[0.95] tracking-tight text-white sm:max-w-[330px] sm:text-[30px] lg:max-w-[560px] lg:text-[56px]">Trending Boxes</h1>
                <p className="mt-1.5 max-w-[168px] text-[8px] font-black uppercase leading-tight text-white/95 sm:max-w-[300px] sm:text-[11px] lg:max-w-[500px] lg:text-lg">Open the boxes everyone is watching right now.</p>
              </div>
              <div className="absolute -right-8 top-1/2 flex -translate-y-1/2 gap-1.5 sm:right-3 sm:gap-2 lg:right-8 lg:gap-3">
                {(trendingBoxes.length ? trendingBoxes.slice(0, 4) : [{ id: 'a', name: 'Starter Box', image: '' }, { id: 'b', name: 'Premium Box', image: '' }] as any).map((box: MysteryBox, index: number) => (
                  <div key={box.id ?? index} className="grid h-[116px] w-[70px] place-items-center overflow-visible rounded-xl p-0 sm:h-[150px] sm:w-[96px] lg:h-[200px] lg:w-[132px]">
                    {box.image ? <img src={box.image} alt="" width={160} height={160} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} className="h-full w-full object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.38)]" /> : <span className="text-center text-sm font-black uppercase text-white drop-shadow-lg">{box.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <span className="sr-only">{showFreeBoxHero ? 'Open your free box' : showPromoBoxHero ? 'Open Promo Box' : showDepositSlide ? 'Claim First deposit bonus offer' : 'View trending boxes'}</span>
        </button>
        <div className="mt-2 flex justify-center gap-1.5">
          {heroSlides.map((slide, index) => <button key={slide} type="button" aria-label={`Show ${slide === 'free-box' ? 'free box' : slide === 'promo-box' ? 'Promo Box' : slide === 'deposit-match' ? 'First deposit bonus offer' : 'hot picks'} slide`} onClick={() => setActiveHeroSlide(index)} className={`h-1.5 w-1.5 rounded-full ${index === activeHeroSlide ? 'bg-[#8b5cf6]' : 'bg-slate-600'}`} />)}
        </div>
      </section>

      <section className="pullz-home-trust-grid mt-5 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#070a12]/92 p-1.5 shadow-[inset_0_0_20px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/10 sm:rounded-2xl sm:p-0">
          {[
            { title: 'First Pull Free', description: 'No deposit required', icon: Gift },
            { title: 'Real Cards', description: 'Shipped to your door', icon: Truck },
            { title: 'Provably Fair', description: 'Every pull verifiable', icon: ShieldCheck },
            { title: 'Keep or Sell', description: 'You’re always in control', icon: RefreshCw }
          ].map(({ title, description, icon: Icon }) => (
            <div key={title} className="flex min-h-[68px] min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-[#101827]/82 px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[72px] sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3 lg:px-4" aria-label={`${title}: ${description}`}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#8b5cf6]/35 bg-[#8b5cf6]/10 text-[#a78bfa] shadow-[0_0_18px_rgba(139,92,246,0.18)] sm:h-9 sm:w-9">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="min-w-0 leading-none">
                <span className="block text-[11px] font-black uppercase leading-tight tracking-tight text-white sm:text-[13px] lg:text-[15px]">{title}</span>
                <span className="mt-1 block text-[8px] font-black uppercase leading-tight tracking-[0.06em] text-slate-400 sm:text-[9px] lg:text-[10px]">{description}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="mobile-customer-reviews" className="pullz-home-reviews scroll-mt-4 mt-4 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Community pulls</h2></div>
          <button type="button" onClick={handleSubmitReview} aria-label="Submit your pull, get 50 coins" className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-[#252d42] px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-200 active:scale-[0.98]">
            <span>Submit</span>
            <span className="inline-flex items-center gap-0.5 text-[#a78bfa]"><img src={COIN_ICON} alt="" className="h-3 w-3" loading="lazy" decoding="async" />50</span>
          </button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {isReviewsLoading ? Array.from({ length: 2 }).map((_, index) => <MobileCustomerReviewSkeleton key={`review-loading-${index}`} />) : customerReviewCards.map((story) => <MobileCustomerReviewCard key={story.id} story={story} />)}
          <MobileSubmitReviewCard onSubmit={handleSubmitReview} />
        </div>
      </section>

      <section id="mobile-trending-boxes" className="pullz-home-trending-grid scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Box className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Trending Boxes</h2></div>
          <button type="button" onClick={onViewAllBoxes} className="rounded-full bg-[#252d42] px-3 py-2 text-[10px] font-black uppercase text-slate-200 active:scale-[0.98]">See more</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(trendingBoxes.length ? trendingBoxes.slice(0, 6) : Array.from({ length: 6 }) as MysteryBox[]).map((box, index) => box ? (
            <button key={box.id} onClick={() => onOpenBox(box.id)} className="group relative h-[172px] overflow-hidden rounded-[20px] border border-white/10 bg-[#121318] p-2.5 text-left shadow-[0_12px_26px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-violet-300/50 active:scale-[0.98] sm:h-[184px] lg:h-[204px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(139,92,246,0.16),transparent_42%),linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.46))]" />
              <div className="relative z-10 h-[112px] sm:h-[122px] lg:h-[138px]"><img src={box.image} alt={box.name} width={160} height={160} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105" /></div>
              <div className="absolute inset-x-2.5 bottom-2.5 z-20 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[10px] font-black uppercase text-white sm:text-xs">{box.name}</span>
                <CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} className="shrink-0 text-[10px] font-black text-[#c4b5fd] sm:text-xs" iconClassName="h-3 w-3" animated={false} />
              </div>
            </button>
          ) : (
            <div key={`trending-loading-${index}`} className="h-[158px] animate-pulse rounded-xl bg-[#242b31] sm:h-[170px] lg:h-[188px]" aria-hidden="true" />
          ))}
        </div>
      </section>

      <MobileLiveWins wins={mobileLiveWins} isLoading={isLiveWinsLoading} onOpenBox={onOpenBox} />

      <HowItWorksSection />
      <HomepageFaqSection />

      {isSubmitReviewOpen && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <form onSubmit={handleSubmitReviewUpload} className="w-full rounded-2xl border border-white/10 bg-[#15192a] p-4 text-white shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black uppercase">Submit yours</h3><button type="button" onClick={() => setIsSubmitReviewOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10">×</button></div>
            <label className="block rounded-xl border border-dashed border-[#8b5cf6]/50 bg-black/20 p-4 text-center text-sm font-bold text-slate-200">
              {submitReviewFile ? submitReviewFile.name : 'Tap to add an image'}
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => setSubmitReviewFile(event.target.files?.[0] ?? null)} />
            </label>
            <textarea value={submitReviewCaption} onChange={(event) => setSubmitReviewCaption(event.target.value)} placeholder="Caption (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-[#0d1220] p-3 text-sm text-white" />
            {submitReviewNotice && <p className="mt-2 text-sm font-bold text-[#a78bfa]">{submitReviewNotice}</p>}
            <button type="submit" disabled={isSubmittingReview} className="mt-3 w-full rounded-xl bg-[#8b5cf6] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-60">{isSubmittingReview ? 'Submitting...' : 'Submit for review'}</button>
          </form>
        </div>
      )}
    </div>
  );
};

export const HomeReplica: React.FC<HomeReplicaProps> = ({ trendingBoxIds = [], onOpenBox, onViewAllBoxes }) => {
  const performanceMode = usePerformanceMode();
  const [homepageBoxes, setHomepageBoxes] = useState<MysteryBox[]>([]);
  const [summaryError, setSummaryError] = useState(false);
  const [configuredBoxes, setConfiguredBoxes] = useState<MysteryBox[]>([]);
  // Mobile renders six cards; desktop gets a modest twelve-summary buffer.
  const summaryLimit = performanceMode.isMobile ? 8 : 12;
  const loadSummaries = () => {
    setSummaryError(false);
    void getHomepageSummaries(summaryLimit).then((page) => setHomepageBoxes(page)).catch(() => setSummaryError(true));
  };
  useEffect(() => { loadSummaries(); }, [summaryLimit]);
  const trendingBoxIdKey = trendingBoxIds.join('|');
  useEffect(() => {
    let cancelled = false;
    setConfiguredBoxes([]);
    void getConfiguredHomepageSummaries([...trendingBoxIds, PROMO_BOX_ID], homepageBoxes).then((selected) => {
      if (!cancelled) setConfiguredBoxes(selected);
    });
    return () => { cancelled = true; };
  }, [homepageBoxes, trendingBoxIdKey]);
  const boxes = useMemo(() => {
    const byId = new Map(homepageBoxes.map((box) => [box.id, box]));
    configuredBoxes.forEach((box) => byId.set(box.id, box));
    return [...byId.values()];
  }, [homepageBoxes, configuredBoxes]);
  const freeSignupBox = homepageBoxes.find((box) => box.isDaily) ?? null;
  const promoBox = boxes.find((box) => box.id === PROMO_BOX_ID) ?? null;
  return (
    <div className="pullz-home-shell min-h-screen bg-[radial-gradient(circle_at_68%_10%,rgba(92,50,255,0.20),transparent_24rem),radial-gradient(circle_at_28%_35%,rgba(28,119,255,0.10),transparent_30rem),#05060a] text-white">
      {summaryError && <div className="mx-auto mt-3 max-w-xl px-3 text-center text-sm text-red-100">Featured boxes are temporarily unavailable. <button type="button" className="underline" onClick={() => { invalidateHomepageSummaries(summaryLimit); loadSummaries(); }}>Retry</button></div>}
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} freeSignupBox={freeSignupBox} promoBox={promoBox} trendingBoxIds={trendingBoxIds} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
      </main>
    </div>
  );
};
