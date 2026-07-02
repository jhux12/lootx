import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, ChevronLeft, ChevronRight, Coins, CreditCard, Gift, ShieldCheck, Sparkles, Trophy, Truck, Zap } from 'lucide-react';
import { Timestamp, addDoc, collection, limit, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
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
  common: 'from-slate-400 to-slate-600',
  uncommon: 'from-emerald-300 to-emerald-700',
  rare: 'from-cyan-400 to-blue-700',
  epic: 'from-purple-400 to-fuchsia-800',
  legendary: 'from-amber-300 to-yellow-700'
};

const MOBILE_REVIEW_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1613771404721-1f92d799e49f?auto=format&fit=crop&w=700&q=75';

const MobileLiveWinCard = ({ win, onOpenBox }: { win: MobileLiveWin; onOpenBox: (boxId: string) => void }) => (
  <button type="button" onClick={() => onOpenBox(win.boxId)} className={`relative h-[128px] min-w-[100px] overflow-hidden rounded-md bg-gradient-to-br ${MOBILE_LIVE_WIN_ACCENT[win.rarity]} p-2 text-left shadow-[0_14px_28px_rgba(0,0,0,0.26)] active:scale-[0.98]`} aria-label={`Open box for ${win.rarity} live win`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.25),transparent_36%),linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.24))]" />
    {win.image ? <img src={win.image} alt="" className="absolute inset-x-0 bottom-2 top-3 z-10 mx-auto h-[96px] w-[96px] object-contain drop-shadow-[0_13px_16px_rgba(0,0,0,0.42)]" loading="lazy" /> : null}
    <div className="absolute bottom-2 left-2 z-30 rounded bg-black/20 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.rarity}</div>
    <div className="absolute bottom-2 right-2 z-30 rounded bg-white/18 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.timeAgo}</div>
  </button>
);


const MobileCustomerReviewCard = ({ story }: { story: MobileCustomerReview }) => {
  const initial = (story.username || 'P').trim().charAt(0).toUpperCase();
  return (
    <article className="min-w-[298px] overflow-hidden rounded-md bg-[#202337] shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
      <div className="aspect-[4/5] w-full overflow-hidden bg-[#141829]">
        <img src={story.mediaUrl} alt={`${story.username || 'Customer'} Pullz review`} className="h-full w-full object-cover" loading="lazy" />
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
  const heroSlides = [
    {
      id: 'free-welcome-box',
      badge: 'FREE WELCOME BOX',
      title: 'OPEN YOUR FIRST BOX FREE',
      subtitle: 'Win a real collectible with no purchase required.',
      buttonText: 'Open Free Box',
      buttonLink: '/boxes',
      Icon: Gift
    },
    {
      id: 'real-items',
      badge: 'REAL ITEMS • REAL SHIPMENTS',
      title: 'WIN REAL ITEMS',
      subtitle: 'Ship your pulls or sell them back instantly.',
      buttonText: 'Browse Boxes',
      buttonLink: '/boxes',
      Icon: Truck
    },
    {
      id: 'first-deposit-bonus',
      badge: 'FIRST DEPOSIT BONUS',
      title: 'GET 50% MORE ON YOUR FIRST DEPOSIT',
      subtitle: 'Start with extra balance and open more boxes.',
      buttonText: 'Claim Bonus',
      buttonLink: '/top-up',
      Icon: Sparkles
    }
  ] as const;

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
    const reviewsQuery = query(collection(db, 'liveCommunityStories'), where('approved', '==', true), limit(12));
    return onSnapshot(reviewsQuery, (snapshot) => {
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
  }, []);

  const activeHero = heroSlides[activeHeroSlide] ?? heroSlides[0];

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

  const handleHeroAction = (buttonLink = activeHero.buttonLink) => {
    if (buttonLink === '/top-up') {
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
      window.history.replaceState({}, '', '/top-up');
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
      <section className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-4 lg:px-6">
        <div onTouchStart={handleHeroTouchStart} onTouchEnd={handleHeroTouchEnd} className="relative mx-auto h-[190px] w-full max-w-[1180px] overflow-hidden rounded-[1.28rem] text-left shadow-[0_18px_34px_rgba(0,0,0,0.24)] sm:h-[230px] sm:rounded-[1.6rem] lg:h-[310px] lg:rounded-[2rem]">
          <div className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform" style={{ transform: `translate3d(-${activeHeroSlide * 100}%,0,0)` }}>
            {heroSlides.map(({ id, badge, title, subtitle, buttonText, buttonLink, Icon }, slideIndex) => (
              <div key={id} className="relative h-full w-full shrink-0 overflow-hidden bg-[linear-gradient(135deg,#6225ef_0%,#4f7ff4_100%)] px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_50%_118%,rgba(93,247,177,0.20),transparent_42%),radial-gradient(circle_at_16%_20%,rgba(34,211,238,0.16),transparent_30%)]" />
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((coinIndex) => (
                    <Coins
                      key={`${id}-hero-coin-${coinIndex}`}
                      className="absolute h-4 w-4 animate-[hero-coin-rain_7s_linear_infinite] text-amber-300/45 drop-shadow-[0_8px_12px_rgba(0,0,0,0.20)] sm:h-6 sm:w-6 lg:h-8 lg:w-8"
                      style={{
                        left: `${14 + ((coinIndex * 13 + slideIndex * 7) % 72)}%`,
                        animationDelay: `${coinIndex * -0.85}s`,
                        animationDuration: `${6.8 + (coinIndex % 3) * 0.6}s`,
                        transform: `rotate(${coinIndex * 23}deg)`
                      }}
                    />
                  ))}
                </div>
                <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                  <div className="inline-flex max-w-[92%] items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] sm:px-3 sm:text-[10px] lg:text-xs">
                    <Icon className="h-3 w-3 shrink-0 lg:h-4 lg:w-4" />
                    <span className="truncate">{badge}</span>
                  </div>
                  <h1 className="mt-3 max-w-[310px] text-[22px] font-black uppercase leading-[0.98] tracking-tight text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.26)] sm:max-w-[620px] sm:text-[38px] lg:max-w-[900px] lg:text-[58px]">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-[300px] text-[12px] font-bold leading-snug text-white/90 sm:max-w-[520px] sm:text-sm lg:max-w-[680px] lg:text-lg">
                    {subtitle}
                  </p>
                  <button type="button" onClick={() => handleHeroAction(buttonLink)} className="mt-4 rounded-full bg-[#52f7b0] px-5 py-2.5 text-[11px] font-black uppercase tracking-wide text-[#07120d] shadow-[0_12px_28px_rgba(82,247,176,0.28)] transition hover:bg-[#7dffd0] active:scale-[0.98] sm:px-6 sm:text-xs lg:px-7 lg:py-3">
                    {buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <style>{`@keyframes hero-coin-rain { 0% { transform: translate3d(0,-150%,0) rotate(0deg); opacity: 0; } 14% { opacity: .72; } 78% { opacity: .48; } 100% { transform: translate3d(14px,280px,0) rotate(320deg); opacity: 0; } }`}</style>
          <span className="sr-only">{activeHero.buttonText}: {activeHero.title}</span>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {heroSlides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Show ${slide.title} slide`} onClick={() => setActiveHeroSlide(index)} className={`h-1.5 rounded-full transition-all ${index === activeHeroSlide ? 'w-5 bg-[#52f7b0]' : 'w-1.5 bg-slate-600'}`} />)}
        </div>
      </section>

      <section className="mt-5 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Ship Real Items', sublabel: 'To Your Door', icon: Truck },
            { label: 'Provably Fair', sublabel: 'Verified Results', icon: ShieldCheck },
            { label: 'Instant Sellback', sublabel: 'Get Coins Fast', icon: Zap },
            { label: 'Secure Payments', sublabel: 'Instant Delivery', icon: CreditCard }
          ].map(({ label, sublabel, icon: Icon }) => (
            <div key={label} className="flex h-[72px] min-w-0 flex-col items-center justify-center rounded-[1rem] border border-[#24314a] bg-[#101827] text-center shadow-[inset_0_0_18px_rgba(255,255,255,0.025),0_10px_20px_rgba(0,0,0,0.16)]" aria-label={`${label}: ${sublabel}`}>
              <Icon className="mb-1.5 h-5 w-5 text-[#55f7c3]" strokeWidth={2.2} aria-hidden="true" />
              <span className="text-[10px] font-black uppercase leading-none tracking-tight text-white sm:text-[13px]">{label}</span>
              <span className="mt-0.5 text-[7px] font-black uppercase tracking-wide text-[#55f7c3]">{sublabel}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="mobile-trending-boxes" className="scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Box className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Trending Boxes</h2></div>
          <button type="button" onClick={onViewAllBoxes} className="rounded-full bg-[#252d42] px-3 py-2 text-[10px] font-black uppercase text-slate-200 active:scale-[0.98]">See more</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(trendingBoxes.length ? trendingBoxes.slice(0, 6) : Array.from({ length: 6 }) as MysteryBox[]).map((box, index) => box ? (
            <button key={box.id} onClick={() => onOpenBox(box.id)} className="group relative h-[158px] overflow-hidden rounded-xl bg-[#252b3a] p-3 text-left active:scale-[0.98] sm:h-[170px] lg:h-[188px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(93,247,177,0.12),transparent_42%),linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.46))]" />
              <img src={box.image} alt="" className="relative z-10 h-[106px] w-full object-contain transition-transform duration-200 group-hover:scale-105 sm:h-[116px] lg:h-[128px]" />
              <span className="absolute left-1.5 top-1.5 z-20 rounded bg-fuchsia-500 px-1.5 py-0.5 text-[5px] font-black uppercase text-white">Trending</span>
              <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-2 rounded-lg bg-black/22 px-2 py-1.5">
                <span className="min-w-0 truncate text-[10px] font-black uppercase text-white sm:text-xs">{box.name}</span>
                <CoinAmount amount={Math.round(box.price)} className="shrink-0 text-[10px] font-black text-[#5df7b1] sm:text-xs" iconClassName="h-3 w-3" animated={false} />
              </div>
            </button>
          ) : (
            <div key={`trending-loading-${index}`} className="h-[158px] animate-pulse rounded-xl bg-[#242b31] sm:h-[170px] lg:h-[188px]" aria-hidden="true" />
          ))}
        </div>
      </section>

      <section id="mobile-live-wins" className="scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
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

      <section id="mobile-customer-reviews" className="scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Customer Reviews</h2></div>
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
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} trendingBoxIds={trendingBoxIds} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
      </main>
    </div>
  );
};
