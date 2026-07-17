import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Trophy } from 'lucide-react';
import { Timestamp, addDoc, collection, limit, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { COIN_ICON } from '../constants';
import { useGame } from '../context/GameContext';
import { FeaturedCases } from './home/FeaturedCases';
import { HomeHero } from './home/HomeHero';
import { HomeTrustStrip } from './home/HomeTrustStrip';
import { HowItWorks } from './home/HowItWorks';

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

const MobileHomePreview = ({ boxes, demoBoxId, trendingBoxIds, onOpenBox, onViewAllBoxes }: { boxes: MysteryBox[]; demoBoxId?: string | null; trendingBoxIds: string[]; onOpenBox: (boxId: string) => void; onViewAllBoxes: () => void }) => {
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
  const customerReviewCards = customerReviews;

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
  const goToHeroSlide = (direction: 1 | -1) => {
    setActiveHeroSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  };

  const handleHeroTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    heroTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleHeroTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = heroTouchStartRef.current;
    heroTouchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    goToHeroSlide(deltaX < 0 ? 1 : -1);
  };

  const handleDepositOffer = () => {
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
      <HomeHero
        boxes={boxes}
        demoBoxId={demoBoxId}
        trendingBoxIds={trendingBoxIds}
        activeSlide={activeHeroSlide}
        slideCount={heroSlides.length}
        onSlideSelect={setActiveHeroSlide}
        onTouchStart={handleHeroTouchStart}
        onTouchEnd={handleHeroTouchEnd}
        onOpenBox={onOpenBox}
        onExploreCases={onViewAllBoxes}
        onHowItWorks={() => document.getElementById('mobile-how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onDepositOffer={handleDepositOffer}
      />

      <HomeTrustStrip />

      <FeaturedCases
        boxes={boxes}
        trendingBoxIds={trendingBoxIds}
        onOpenBox={onOpenBox}
        onViewAllBoxes={onViewAllBoxes}
      />

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

      <HowItWorks />

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

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, demoBoxId, trendingBoxIds = [], onOpenBox, onViewAllBoxes }) => {
  return (
    <div className="pullz-home-shell min-h-screen bg-pullz-canvas text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} demoBoxId={demoBoxId} trendingBoxIds={trendingBoxIds} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
      </main>
    </div>
  );
};
