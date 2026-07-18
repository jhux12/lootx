import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, ChevronLeft, ChevronRight, Coins, CreditCard, Flame, Gift, ShieldCheck, Sparkles, Trophy, Truck, Users, Zap } from 'lucide-react';
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

const MobileLiveWinCard = ({ win, onOpenBox }: { win: MobileLiveWin; onOpenBox: (boxId: string) => void }) => (
  <button type="button" onClick={() => onOpenBox(win.boxId)} className={`relative h-[128px] min-w-[100px] overflow-hidden rounded-md bg-gradient-to-br ${MOBILE_LIVE_WIN_ACCENT[win.rarity]} p-2 text-left shadow-[0_14px_28px_rgba(0,0,0,0.30)] active:scale-[0.98]`} aria-label={`Open box for ${win.rarity} live win`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.12),transparent_18%),linear-gradient(180deg,transparent_48%,rgba(0,0,0,0.28))]" />
    {win.image ? <img src={win.image} alt="" width={96} height={96} decoding="async" className="absolute inset-x-0 bottom-2 top-3 z-10 mx-auto h-[96px] w-[96px] object-contain drop-shadow-[0_13px_16px_rgba(0,0,0,0.42)]" loading="lazy" /> : null}
    <div className="absolute bottom-2 left-2 z-30 rounded bg-black/20 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.rarity}</div>
    <div className="absolute bottom-2 right-2 z-30 rounded bg-white/18 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.timeAgo}</div>
  </button>
);


const MobileCustomerReviewCard = ({ story }: { story: MobileCustomerReview }) => {
  const initial = (story.username || 'P').trim().charAt(0).toUpperCase();
  return (
    <article className="min-w-[298px] overflow-hidden rounded-md bg-[#202337] shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
      <div className="aspect-[4/5] w-full overflow-hidden bg-[#141829]">
        <img src={story.mediaUrl} alt={`${story.username || 'Customer'} Pullz review`} className="h-full w-full object-cover" loading="lazy" decoding="async" width={298} height={373} />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-300 to-purple-500 text-sm font-black text-white ring-2 ring-white/80">{initial}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-white">{story.username || 'Pullz customer'}</div>
            <div className="text-xs font-bold text-slate-500">{story.timestampLabel || 'recently'}</div>
          </div>
        </div>
        {story.caption ? <p className="mt-3 text-sm font-bold leading-5 text-indigo-100">{story.caption}</p> : null}
      </div>
    </article>
  );
};

const MobileCustomerReviewSkeleton = () => (
  <div className="min-w-[298px] animate-pulse overflow-hidden rounded-md" aria-hidden="true">
    <div className="aspect-[4/5] rounded-md bg-[#242b31]" />
    <div className="flex items-center gap-2 px-1 pt-3">
      <div className="h-9 w-9 rounded-full bg-[#242b31]" />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[#242b31]" />
        <div className="h-2.5 w-16 rounded bg-[#242b31]" />
      </div>
    </div>
  </div>
);

const MobileSubmitReviewCard = ({ onSubmit }: { onSubmit: () => void }) => (
  <button
    type="button"
    onClick={onSubmit}
    className="flex min-w-[298px] flex-col items-center justify-center rounded-md border-2 border-dashed border-[#5df7b1]/55 bg-[#202337]/78 p-5 text-center shadow-[0_14px_28px_rgba(0,0,0,0.24)] active:scale-[0.98]"
  >
    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#5df7b1]/15 text-3xl">＋</div>
    <h3 className="mt-4 text-xl font-black uppercase text-white">Submit Yours</h3>
    <p className="mt-2 max-w-[210px] text-sm font-bold leading-5 text-slate-300">Share your Pullz delivery or big hit for a chance to be featured.</p>
  </button>
);

const MobileHomePreview = ({ boxes, trendingBoxIds, onOpenBox, onViewAllBoxes }: { boxes: MysteryBox[]; trendingBoxIds: string[]; onOpenBox: (boxId: string) => void; onViewAllBoxes: () => void }) => {
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
      <section className="px-0 pt-0 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-3 sm:pt-3">
        <button type="button" onClick={handleHeroAction} onTouchStart={handleHeroTouchStart} onTouchEnd={handleHeroTouchEnd} className="pullz-home-hero relative mx-auto h-[178px] w-full max-w-[1180px] overflow-hidden rounded-b-[1.15rem] border-b border-white/5 bg-[#05040b] text-left shadow-[0_18px_38px_rgba(0,0,0,0.46)] active:scale-[0.995] sm:h-[230px] sm:rounded-[1.6rem] lg:h-[300px] lg:rounded-[2rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_46%,rgba(153,45,255,0.58),transparent_31%),radial-gradient(circle_at_15%_0%,rgba(61,25,115,0.7),transparent_38%),linear-gradient(120deg,#05030b_0%,#090618_47%,#020106_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.36),transparent_58%),radial-gradient(circle_at_63%_100%,rgba(117,32,255,0.34),transparent_29%)]" />
          <div className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-md bg-white/8 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-white ring-1 ring-white/10 backdrop-blur sm:left-7 sm:top-6 sm:text-[11px] lg:text-sm"><Sparkles className="h-3 w-3 text-white" />50% Deposit Match</div>
          <div className="relative z-10 flex h-full items-center">
            <div className="w-[50%] pl-4 pt-6 sm:pl-7 lg:pl-12">
              <h1 className="max-w-[185px] text-[20px] font-black uppercase leading-[0.98] tracking-[-0.04em] text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.7)] sm:max-w-[350px] sm:text-[38px] lg:max-w-[520px] lg:text-[62px]">Get a <span className="text-[#7d49ff]">50%</span> Bonus on Your First Deposit</h1>
              <p className="mt-3 max-w-[170px] text-[8px] font-semibold leading-3 text-white/82 sm:max-w-[300px] sm:text-xs lg:max-w-[420px] lg:text-base">Kickstart your pulls with up to <span className="block pt-1 font-black text-[#8c47ff]">$1,000</span> in bonus coins!</p>
              <div className="mt-3 flex items-center gap-3 sm:mt-5">
                <span className="inline-flex h-11 min-w-[94px] items-center justify-center rounded-md bg-[#7427ee] px-3 text-[8px] font-black text-white shadow-[0_12px_30px_rgba(116,39,238,0.45)] sm:h-12 sm:min-w-[150px] sm:rounded-lg sm:text-sm">Deposit Now</span>
                <span className="text-[8px] font-bold text-white/78 sm:text-sm">Learn More</span>
              </div>
            </div>
            <div className="relative h-full flex-1">
              <div className="absolute right-0 top-1/2 h-[155px] w-[185px] -translate-y-1/2 sm:right-7 sm:h-[220px] sm:w-[280px] lg:h-[300px] lg:w-[380px]">
                <div className="absolute inset-x-6 bottom-4 h-12 rounded-full bg-[#7a22ff]/55 blur-2xl" />
                <div className="absolute left-10 top-12 h-20 w-28 rotate-[-8deg] rounded-2xl border border-[#b566ff]/45 bg-[linear-gradient(145deg,#211336,#101020_55%,#06070e)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.04),0_0_36px_rgba(149,44,255,0.7)] sm:h-28 sm:w-40 lg:h-40 lg:w-56">
                  <div className="absolute left-3 top-3 h-5 w-16 rounded bg-[#7f2cff]/70 sm:h-7 sm:w-24 lg:h-10 lg:w-32" />
                  <div className="absolute bottom-3 left-3 h-9 w-4 rounded bg-[#8a31ff]/80 sm:h-14 sm:w-6 lg:h-20 lg:w-8" />
                  <div className="absolute bottom-3 left-10 h-9 w-4 rounded bg-[#8a31ff]/80 sm:h-14 sm:w-6 lg:h-20 lg:w-8" />
                  <div className="absolute right-3 top-4 h-11 w-4 rounded bg-[#1a1626] sm:h-16 sm:w-6 lg:h-24 lg:w-8" />
                </div>
                {(trendingBoxes.length ? trendingBoxes.slice(0, 1) : boxes.slice(0, 1)).map((box) => <img key={box.id} src={box.image} alt="" className="absolute left-4 top-2 h-16 w-16 -rotate-12 object-contain drop-shadow-[0_12px_22px_rgba(141,42,255,0.7)] sm:h-24 sm:w-24 lg:h-32 lg:w-32" loading="eager" decoding="async" />)}
                {[0,1,2,3,4,5].map((i) => <Coins key={i} className="absolute h-7 w-7 text-[#8f43ff] drop-shadow-[0_0_14px_rgba(168,85,247,0.9)] sm:h-10 sm:w-10" style={{ left: `${8 + (i*23)%82}%`, top: `${9 + (i*17)%72}%`, transform: `rotate(${i*35}deg)` }} />)}
              </div>
            </div>
          </div>
          <button type="button" onClick={(event) => { event.stopPropagation(); goToHeroSlide(-1); }} aria-label="Previous promotion" className="absolute left-0 top-1/2 z-30 grid h-8 w-6 -translate-y-1/2 place-items-center rounded-r-lg bg-black/20 text-white/70"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); goToHeroSlide(1); }} aria-label="Next promotion" className="absolute right-0 top-1/2 z-30 grid h-8 w-6 -translate-y-1/2 place-items-center rounded-l-lg bg-black/20 text-white/70"><ChevronRight className="h-4 w-4" /></button>
        </button>
        <div className="mt-2 flex justify-center gap-2">
          {heroSlides.map((slide, index) => <button key={slide} type="button" aria-label={`Show ${slide === 'deposit-match' ? 'First deposit bonus offer' : 'hot picks'} slide`} onClick={() => setActiveHeroSlide(index)} className={`h-2 w-2 rounded-full ${index === activeHeroSlide ? 'bg-[#7d49ff]' : 'bg-[#43335e]'}`} />)}
        </div>
      </section>

      <section className="mt-4 px-3 sm:px-4 lg:px-6">
        <div className="grid grid-cols-5 overflow-hidden rounded-xl bg-[#070912] shadow-[0_10px_26px_rgba(0,0,0,0.34)] ring-1 ring-white/5">
          {[
            { label: 'Boxes', icon: Box, active: true },
            { label: 'Battles', icon: Zap },
            { label: 'Rewards', icon: Gift },
            { label: 'Pull Pass', icon: ShieldCheck },
            { label: 'Affiliates', icon: Users }
          ].map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" onClick={label === 'Boxes' ? onViewAllBoxes : undefined} className="flex h-[52px] min-w-0 flex-col items-center justify-center gap-1 text-center sm:h-[72px]">
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${active ? 'text-[#8b37ff]' : 'text-white/65'}`} strokeWidth={2.1} />
              <span className={`${active ? 'text-white' : 'text-white/70'} text-[8px] font-bold sm:text-xs`}>{label}</span>
            </button>
          ))}
        </div>
      </section>


      <section className="mt-4 grid grid-cols-2 gap-3 px-3 sm:px-4 lg:px-6">
        <button type="button" onClick={handleSubmitReview} className="relative h-[84px] overflow-hidden rounded-xl bg-[#11101b] p-3 text-left ring-1 ring-white/5 sm:h-[120px] sm:p-5">
          <h3 className="text-[12px] font-black text-[#ba57ff] sm:text-base">Invite & Earn</h3>
          <p className="mt-1 max-w-[100px] text-[8px] font-semibold leading-3 text-white sm:max-w-[190px] sm:text-sm sm:leading-5">Earn up to 10% from your friends' deposits.</p>
          <span className="mt-2 inline-flex rounded bg-[#482082] px-3 py-1.5 text-[8px] font-black text-white sm:text-xs">Invite Now</span>
          <Users className="absolute bottom-1 right-3 h-14 w-14 text-[#7a2fff] sm:h-20 sm:w-20" />
        </button>
        <button type="button" onClick={handleHeroAction} className="relative h-[84px] overflow-hidden rounded-xl bg-[#151104] p-3 text-left ring-1 ring-white/5 sm:h-[120px] sm:p-5">
          <div className="absolute right-2 top-2 text-[8px] font-bold text-white/70">⏱ 11h 32m</div>
          <h3 className="text-[12px] font-black text-[#ffd21f] sm:text-base">Daily Free Box</h3>
          <p className="mt-1 max-w-[95px] text-[8px] font-semibold leading-3 text-white sm:max-w-[170px] sm:text-sm sm:leading-5">Claim your free box every 24 hours.</p>
          <span className="mt-2 inline-flex rounded bg-[#4a3210] px-3 py-1.5 text-[8px] font-black text-white sm:text-xs">Claim Now ›</span>
          <Coins className="absolute bottom-2 right-5 h-14 w-14 text-[#ffb800] sm:h-20 sm:w-20" />
        </button>
      </section>

      <section id="mobile-trending-boxes" className="pullz-home-trending-grid scroll-mt-4 mt-5 px-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-2 flex items-center justify-between px-0">
          <div className="flex items-center gap-1"><Box className="h-4 w-4 text-[#8b37ff]" /><h2 className="text-[13px] font-black text-white">Featured Boxes</h2></div>
          <button type="button" onClick={onViewAllBoxes} className="pr-1 text-[10px] font-black text-[#b04cff] active:scale-[0.98]">View All ›</button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
          {(trendingBoxes.length ? trendingBoxes.slice(0, 6) : Array.from({ length: 6 }) as MysteryBox[]).map((box, index) => box ? (
            <button key={box.id} onClick={() => onOpenBox(box.id)} className="group relative h-[106px] overflow-hidden rounded-lg bg-[#090b15] p-1.5 text-left ring-1 ring-white/6 active:scale-[0.98] sm:h-[170px] sm:p-3 lg:h-[188px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(93,247,177,0.12),transparent_42%),linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.46))]" />
              <img src={box.image} alt="" width={160} height={160} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" className="relative z-10 h-[52px] w-full object-contain transition-transform duration-200 group-hover:scale-105 sm:h-[116px] lg:h-[128px]" />
              <span className="absolute right-1 top-1 z-20 rounded bg-[#0fc980] px-1 py-0.5 text-[5px] font-black text-white">New</span>
              <div className="absolute inset-x-1.5 bottom-1.5 z-20">
                <span className="block truncate text-[7px] font-black text-white sm:text-xs">{box.name}</span>
                <CoinAmount amount={Math.round(box.price)} className="mt-0.5 text-[7px] font-black text-[#f1c93b] sm:text-xs" iconClassName="h-2.5 w-2.5" animated={false} />
                <span className="mt-1 grid h-5 place-items-center rounded bg-[#6f26dd] text-[6px] font-black text-white sm:h-7 sm:text-xs">Open Now</span>
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

      <section id="mobile-customer-reviews" className="pullz-home-reviews scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Customer Reviews</h2></div>
          <button type="button" onClick={handleSubmitReview} aria-label="Submit your pull, get 50 coins" className="inline-flex w-full flex-wrap items-center justify-center gap-1.5 rounded-full bg-[#252d42] px-3 py-2 text-[10px] font-black uppercase text-slate-200 active:scale-[0.98] sm:w-auto sm:flex-nowrap">
            <span>Submit Your Pull, Get</span>
            <span className="inline-flex items-center gap-1 text-[#5df7b1]"><img src={COIN_ICON} alt="" className="h-3.5 w-3.5" loading="lazy" decoding="async" />50</span>
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
          {isReviewsLoading ? Array.from({ length: 2 }).map((_, index) => <MobileCustomerReviewSkeleton key={`review-loading-${index}`} />) : customerReviewCards.map((story) => <MobileCustomerReviewCard key={story.id} story={story} />)}
          <MobileSubmitReviewCard onSubmit={handleSubmitReview} />
        </div>
      </section>

      <section id="mobile-how-it-works" className="scroll-mt-4 mt-7 px-3 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">How It Works</h2></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: '🎁', title: 'Open a Box', body: 'Choose from Pokémon, Slabs, ETBs, and exclusive mystery boxes.' },
            { icon: '🏆', title: 'Pull Real Items', body: 'Every spin reveals an item you can keep or instantly sell back.' },
            { icon: '📦', title: 'Ship Your Wins', body: "Build an order and we’ll ship it directly to your door." }
          ].map((step) => (
            <article key={step.title} className="relative overflow-hidden rounded-2xl border border-[#24314a] bg-[#101827] p-4 shadow-[inset_0_0_18px_rgba(255,255,255,0.025),0_10px_20px_rgba(0,0,0,0.16)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(93,247,177,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]" />
              <div className="relative z-10 flex items-start gap-3 sm:flex-col">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#242b31] text-2xl shadow-[inset_0_0_0_1px_rgba(58,65,70,0.72)]" aria-hidden="true">{step.icon}</span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white">{step.title}</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{step.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isSubmitReviewOpen && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <form onSubmit={handleSubmitReviewUpload} className="w-full rounded-2xl border border-white/10 bg-[#15192a] p-4 text-white shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black uppercase">Submit yours</h3><button type="button" onClick={() => setIsSubmitReviewOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10">×</button></div>
            <label className="block rounded-xl border border-dashed border-[#5df7b1]/50 bg-black/20 p-4 text-center text-sm font-bold text-slate-200">
              {submitReviewFile ? submitReviewFile.name : 'Tap to add an image'}
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => setSubmitReviewFile(event.target.files?.[0] ?? null)} />
            </label>
            <textarea value={submitReviewCaption} onChange={(event) => setSubmitReviewCaption(event.target.value)} placeholder="Caption (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-[#0d1220] p-3 text-sm text-white" />
            {submitReviewNotice && <p className="mt-2 text-sm font-bold text-[#5df7b1]">{submitReviewNotice}</p>}
            <button type="submit" disabled={isSubmittingReview} className="mt-3 w-full rounded-xl bg-[#5df7b1] px-4 py-3 text-sm font-black uppercase text-[#101827] disabled:opacity-60">{isSubmittingReview ? 'Submitting...' : 'Submit for review'}</button>
          </form>
        </div>
      )}
    </div>
  );
};

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, trendingBoxIds = [], onOpenBox, onViewAllBoxes }) => {
  return (
    <div className="pullz-home-shell min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} trendingBoxIds={trendingBoxIds} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
      </main>
    </div>
  );
};
