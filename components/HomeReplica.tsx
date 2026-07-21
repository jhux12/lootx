import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CheckCircle2, ChevronLeft, ChevronRight, Coins, CreditCard, Flame, ShieldCheck, Sparkles, Trophy, Truck, Zap } from 'lucide-react';
import { HowItWorksSection } from './HowItWorksSection';
import { HomepageFaqSection } from './HomepageFaqSection';
import { Timestamp, addDoc, collection, limit, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { COIN_ICON } from '../constants';
import { useGame } from '../context/GameContext';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
  trendingBoxIds?: string[];
  heroImageUrls?: string[];
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string) => void;
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
const DEFAULT_HOME_HERO_IMAGES = [
  MOBILE_DEPOSIT_MATCH_IMAGE,
  ''
];

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

const MobileHomePreview = ({ boxes, trendingBoxIds, heroImageUrls, onOpenBox, onViewAllBoxes }: { boxes: MysteryBox[]; trendingBoxIds: string[]; heroImageUrls: string[]; onOpenBox: (boxId: string) => void; onViewAllBoxes: () => void }) => {
  const { isAuthenticated, openAuthModal, setShowTopUpModal, setTopUpModalIntent, user } = useGame();
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const heroTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [activeLiveWinIndex, setActiveLiveWinIndex] = useState(0);
  const [customerReviews, setCustomerReviews] = useState<MobileCustomerReview[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [submitReviewFile, setSubmitReviewFile] = useState<File | null>(null);
  const [submitReviewCaption, setSubmitReviewCaption] = useState('');
  const [submitReviewNotice, setSubmitReviewNotice] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const cards = boxes.slice(0, 6);
  const originals = cards.length ? cards.slice(0, 3) : [];
  const trendingBoxes = useMemo(() => {
    const selected = trendingBoxIds
      .map((id) => boxes.find((box) => box.id === id))
      .filter(Boolean) as MysteryBox[];
    return (selected.length ? selected : boxes).slice(0, 6);
  }, [boxes, trendingBoxIds]);
  const mobileLiveWins = useMemo<MobileLiveWin[]>(() => {
    const itemPool = boxes
      .flatMap((box) => box.items.map((item) => ({ item, boxId: box.id })))
      .filter(({ item }) => item.image && item.name);

    if (!itemPool.length) return [];

    const rarityTargets: Array<{ rarity: MobileLiveWin['rarity']; count: number }> = [
      { rarity: 'common', count: 4 },
      { rarity: 'uncommon', count: 2 },
      { rarity: 'rare', count: 2 },
      { rarity: 'epic', count: 1 },
      { rarity: 'legendary', count: 1 }
    ];
    const selected: typeof itemPool = [];
    const usedKeys = new Set<string>();
    const shuffledPool = [...itemPool].sort(() => Math.random() - 0.5);

    rarityTargets.forEach(({ rarity, count }) => {
      shuffledPool
        .filter(({ item }) => item.rarity === rarity)
        .slice(0, count)
        .forEach((entry) => {
          const key = `${entry.boxId}-${entry.item.id}`;
          if (!usedKeys.has(key)) {
            usedKeys.add(key);
            selected.push(entry);
          }
        });
    });

    if (selected.length < 10) {
      shuffledPool.forEach((entry) => {
        if (selected.length >= 10) return;
        const key = `${entry.boxId}-${entry.item.id}`;
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          selected.push(entry);
        }
      });
    }

    return selected.slice(0, 10).sort(() => Math.random() - 0.5).map(({ item, boxId }, index) => ({
      id: `${boxId}-${item.id}-${index}`,
      title: item.name,
      image: item.image,
      rarity: item.rarity,
      timeAgo: index === 0 ? 'now' : `${index + 1}m`,
      boxId
    }));
  }, [boxes]);
  const displayedLiveWins = mobileLiveWins.length ? [...mobileLiveWins, ...mobileLiveWins] : [];
  const customerReviewCards = customerReviews.length
    ? customerReviews
    : [{ id: 'fallback-review', username: 'edb87', caption: '', mediaUrl: MOBILE_REVIEW_FALLBACK_IMAGE, timestampLabel: '11/20/2025' }];

  useEffect(() => {
    if (mobileLiveWins.length <= 1) return undefined;
    const rotateTimer = window.setInterval(() => {
      setActiveLiveWinIndex((current) => (current + 1) % mobileLiveWins.length);
    }, 2400);
    return () => window.clearInterval(rotateTimer);
  }, [mobileLiveWins.length]);


  useEffect(() => {
    const heroTimer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 10000);
    return () => window.clearInterval(heroTimer);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const loadReviews = () => {
      if (cancelled) return;
      const reviewsQuery = query(collection(db, 'liveCommunityStories'), where('approved', '==', true), limit(12));
      unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
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
      }, () => {
        setCustomerReviews([]);
        setIsReviewsLoading(false);
      });
    };

    const reviewsSection = document.getElementById('mobile-customer-reviews');
    if (!reviewsSection || !('IntersectionObserver' in window)) {
      const timer = window.setTimeout(loadReviews, 1800);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        unsubscribe?.();
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
      unsubscribe?.();
    };
  }, []);

  const heroSlides = ['deposit-match', 'hot-picks'] as const;
  const resolvedHeroImages = heroSlides.map((_, index) => heroImageUrls[index]?.trim() || DEFAULT_HOME_HERO_IMAGES[index] || '');
  const showDepositSlide = activeHeroSlide === 0;

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
      <section className="relative left-1/2 w-screen -translate-x-1/2 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <button type="button" onClick={handleHeroAction} onTouchStart={handleHeroTouchStart} onTouchEnd={handleHeroTouchEnd} className="pullz-home-hero relative h-[clamp(128px,31vw,220px)] w-full overflow-hidden text-left shadow-[0_18px_34px_rgba(0,0,0,0.24)] active:scale-[0.99]">
          <div className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform" style={{ transform: `translate3d(-${activeHeroSlide * 100}%,0,0)` }}>
            <div className="relative h-full w-full shrink-0 overflow-hidden bg-[#060910] p-3 sm:p-5 lg:p-8">
              {resolvedHeroImages[0] ? <img src={resolvedHeroImages[0]} alt="First deposit bonus" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" fetchPriority="high" /> : null}
              <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-black/20" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.20),transparent_32%),radial-gradient(circle_at_50%_118%,rgba(139,92,246,0.22),transparent_38%)]" />
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((coinIndex) => (
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
              </div>
              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] sm:px-3 sm:text-[10px] lg:text-xs"><Sparkles className="h-3 w-3 lg:h-4 lg:w-4" />50% deposit match</div>
                <h1 className="mt-2 max-w-[270px] text-[21px] font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.26)] sm:max-w-[560px] sm:text-[34px] lg:max-w-[880px] lg:text-[58px]">Get a 50% Bonus on Your First Deposit</h1>
              </div>
              <style>{`@keyframes hero-coin-rain { 0% { transform: translate3d(0,-140%,0) rotate(0deg); opacity: 0; } 12% { opacity: .9; } 82% { opacity: .78; } 100% { transform: translate3d(18px,260px,0) rotate(320deg); opacity: 0; } }`}</style>
            </div>
            <div className="relative h-full w-full shrink-0 overflow-hidden bg-[linear-gradient(135deg,#6225ef_0%,#4f7ff4_100%)] p-3 sm:p-5 lg:p-8">
              {resolvedHeroImages[1] ? <img src={resolvedHeroImages[1]} alt="Trending boxes" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.58),rgba(0,0,0,0.12),rgba(0,0,0,0.35)),radial-gradient(circle_at_82%_24%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_48%_118%,rgba(139,92,246,0.22),transparent_36%)]" />
              <div className="relative z-10 flex h-full max-w-[55%] flex-col justify-center sm:max-w-[58%] lg:max-w-[56%]">
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-white sm:px-3 sm:text-[10px] lg:text-xs"><Flame className="h-3 w-3 lg:h-4 lg:w-4" />Trending boxes</div>
                <h1 className="mt-2 max-w-[180px] text-[18px] font-black uppercase leading-[0.95] tracking-tight text-white sm:max-w-[330px] sm:text-[30px] lg:max-w-[560px] lg:text-[56px]">Trending Boxes</h1>
                <p className="mt-1.5 max-w-[168px] text-[8px] font-black uppercase leading-tight text-white/95 sm:max-w-[300px] sm:text-[11px] lg:max-w-[500px] lg:text-lg">Open the boxes everyone is watching right now.</p>
              </div>
            </div>
          </div>
          <span className="sr-only">{showDepositSlide ? 'Claim First deposit bonus offer' : 'View trending boxes'}</span>
        </button>
        <div className="mt-2 flex justify-center gap-1.5">
          {heroSlides.map((slide, index) => <button key={slide} type="button" aria-label={`Show ${slide === 'deposit-match' ? 'First deposit bonus offer' : 'hot picks'} slide`} onClick={() => setActiveHeroSlide(index)} className={`h-1.5 w-1.5 rounded-full ${index === activeHeroSlide ? 'bg-[#8b5cf6]' : 'bg-slate-600'}`} />)}
        </div>
      </section>

      <section className="pullz-home-trust-grid mt-5 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#070a12]/92 p-1.5 shadow-[inset_0_0_20px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/10 sm:rounded-2xl sm:p-0">
          {[
            { value: '100K+', label: 'Boxes Opened', icon: Box },
            { value: '25K+', label: 'Users', icon: Trophy },
            { value: '15K+', label: 'Items Shipped', icon: Truck },
            { value: 'Provably Fair', label: 'Verified Odds', icon: ShieldCheck }
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex min-h-[62px] min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-[#101827]/82 px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[68px] sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3 lg:px-4" aria-label={`${value}: ${label}`}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#8b5cf6]/35 bg-[#8b5cf6]/10 text-[#a78bfa] shadow-[0_0_18px_rgba(139,92,246,0.18)] sm:h-9 sm:w-9">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="min-w-0 leading-none">
                <span className="block truncate text-[15px] font-black uppercase tracking-tight text-white sm:text-[17px] lg:text-xl">{value}</span>
                <span className="mt-1 block truncate text-[8px] font-black uppercase tracking-[0.08em] text-slate-400 sm:text-[9px]">{label}</span>
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
            <button key={box.id} onClick={() => onOpenBox(box.id)} className="group relative h-[158px] overflow-hidden rounded-xl bg-[#252b3a] p-3 text-left active:scale-[0.98] sm:h-[170px] lg:h-[188px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(139,92,246,0.12),transparent_42%),linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.46))]" />
              <img src={box.image} alt="" width={160} height={160} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" className="relative z-10 h-[106px] w-full object-contain transition-transform duration-200 group-hover:scale-105 sm:h-[116px] lg:h-[128px]" />
              <span className="absolute left-1.5 top-1.5 z-20 rounded bg-fuchsia-500 px-1.5 py-0.5 text-[5px] font-black uppercase text-white">Trending</span>
              <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-2 rounded-lg bg-black/22 px-2 py-1.5">
                <span className="min-w-0 truncate text-[10px] font-black uppercase text-white sm:text-xs">{box.name}</span>
                <CoinAmount amount={Math.round(box.price)} className="shrink-0 text-[10px] font-black text-[#a78bfa] sm:text-xs" iconClassName="h-3 w-3" animated={false} />
              </div>
            </button>
          ) : (
            <div key={`trending-loading-${index}`} className="h-[158px] animate-pulse rounded-xl bg-[#242b31] sm:h-[170px] lg:h-[188px]" aria-hidden="true" />
          ))}
        </div>
      </section>

      <section id="mobile-live-wins" className="pullz-home-live-wins scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Live Wins</h2></div>
          <div className="flex gap-2"><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-500"><ChevronLeft className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-400"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-2 transition-transform duration-700 ease-out" style={{ transform: `translate3d(-${activeLiveWinIndex * 108}px,0,0)` }}>
            {(displayedLiveWins.length ? displayedLiveWins.map((win, index) => ({ ...win, id: `${win.id}-${index}` })) : originals.map((box, index) => ({ id: box.id, title: box.name, image: box.image, rarity: (index === 0 ? 'rare' : index === 1 ? 'uncommon' : 'epic') as MobileLiveWin['rarity'], timeAgo: index === 0 ? 'now' : `${index + 1}m`, boxId: box.id }))).map((win) => <MobileLiveWinCard key={win.id} win={win} onOpenBox={onOpenBox} />)}
            {!displayedLiveWins.length && !originals.length ? Array.from({ length: 6 }).map((_, index) => <div key={`live-win-loading-${index}`} className="h-[128px] min-w-[100px] animate-pulse rounded-md bg-[#242b31]" aria-hidden="true" />) : null}
          </div>
        </div>
      </section>

      <HowItWorksSection boxes={boxes} />
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

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, trendingBoxIds = [], heroImageUrls = [], onOpenBox, onViewAllBoxes }) => {
  return (
    <div className="pullz-home-shell min-h-screen overflow-x-hidden bg-[#1b2024] text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} trendingBoxIds={trendingBoxIds} heroImageUrls={heroImageUrls} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
      </main>
    </div>
  );
};
