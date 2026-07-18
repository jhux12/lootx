import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Coins, CreditCard, Gift, ShieldCheck, Sparkles, Star, Trophy, Truck, Zap } from 'lucide-react';
import { Timestamp, addDoc, collection, limit, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { COIN_ICON } from '../constants';
import { useGame } from '../context/GameContext';
import { getBoxTags } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

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

const HOME_LABEL_STYLES: Record<string, { text: string; className: string }> = {
  hot: { text: 'Hot', className: 'bg-[#ff665f] text-[#260806]' },
  new: { text: 'New', className: 'bg-[#37ed86] text-[#062011]' },
  top: { text: 'Popular', className: 'bg-[#29b9ff] text-[#061720]' },
  popular: { text: 'Popular', className: 'bg-[#29b9ff] text-[#061720]' },
  limited: { text: 'Limited', className: 'bg-[#ffd34c] text-[#241a00]' }
};
const HOME_LABEL_PRIORITY = ['hot', 'new', 'top', 'popular', 'limited'];

const getHomeCardLabel = (box: MysteryBox) => {
  const tags = getBoxTags(box);
  const match = HOME_LABEL_PRIORITY.find((tag) => tags.includes(tag));
  return match ? HOME_LABEL_STYLES[match] : null;
};

const QUICK_CASE_GRADIENTS = [
  'bg-[linear-gradient(135deg,#6b39de,#a257ff)]',
  'bg-[linear-gradient(135deg,#ff4b8f,#6f2a97)]',
  'bg-[linear-gradient(135deg,#26aaff,#25527f)]',
  'bg-[linear-gradient(135deg,#ff9f30,#754412)]',
  'bg-[linear-gradient(135deg,#47ec85,#28623e)]',
  'bg-[linear-gradient(135deg,#f1d448,#66580f)]'
];

const QUICK_CASE_SUBTITLES: Record<string, string> = {
  hot: 'Hot right now',
  tech: 'Tech pulls',
  pokemon: 'Fan favorite',
  digital: 'Digital chase',
  holiday: 'Limited drop'
};
const getQuickCaseSubtitle = (box: MysteryBox) => QUICK_CASE_SUBTITLES[box.tag ?? ''] ?? 'Popular pick';

const HOME_TABS = [
  { id: 'all', label: 'Featured' },
  { id: 'new', label: 'New Boxes' },
  { id: 'popular', label: 'Popular' },
  { id: 'premium', label: 'Premium' },
  { id: 'budget', label: 'Under 500' }
] as const;
type HomeTabId = (typeof HOME_TABS)[number]['id'];

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
    <article className="min-w-[280px] max-w-[280px] shrink-0 rounded-xl border border-white/[0.075] bg-[#15141d] p-3.5 shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#8c49df,#2a1e3b)] text-sm font-black text-white">{initial}</div>
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{story.username || 'Pullz customer'}</div>
          <div className="text-[10px] font-bold text-[#777482]">{story.timestampLabel || 'recently'}</div>
        </div>
      </div>
      {story.caption ? <p className="mt-3 text-xs font-semibold leading-5 text-[#aaa6b0]">{story.caption}</p> : null}
      <div className="mt-3 aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#0d0c13]">
        <img src={story.mediaUrl} alt={`${story.username || 'Customer'} Pullz review`} className="h-full w-full object-cover" loading="lazy" decoding="async" width={280} height={210} />
      </div>
      <div className="mt-2.5 flex items-center gap-0.5 text-[#37ed86]" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="h-3.5 w-3.5 fill-current" />
        ))}
      </div>
    </article>
  );
};

const MobileCustomerReviewSkeleton = () => (
  <div className="min-w-[280px] animate-pulse rounded-xl border border-white/[0.075] bg-[#15141d] p-3.5" aria-hidden="true">
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-lg bg-[#1d1b29]" />
      <div className="space-y-2">
        <div className="h-2.5 w-24 rounded bg-[#1d1b29]" />
        <div className="h-2 w-16 rounded bg-[#1d1b29]" />
      </div>
    </div>
    <div className="mt-3 h-8 w-full rounded bg-[#1d1b29]" />
    <div className="mt-3 aspect-[4/3] w-full rounded-lg bg-[#1d1b29]" />
  </div>
);

const MobileSubmitReviewCard = ({ onSubmit }: { onSubmit: () => void }) => (
  <button
    type="button"
    onClick={onSubmit}
    className="flex min-w-[280px] max-w-[280px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#37ed86]/45 bg-[#15141d]/80 p-5 text-center shadow-[0_14px_28px_rgba(0,0,0,0.24)] active:scale-[0.98]"
  >
    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#37ed86]/15 text-3xl">＋</div>
    <h3 className="mt-4 text-lg font-black uppercase text-white">Submit Yours</h3>
    <p className="mt-2 max-w-[210px] text-xs font-bold leading-5 text-[#a4a0ae]">Share your Pullz delivery or big hit for a chance to be featured.</p>
  </button>
);

const MobileHomePreview = ({ boxes, trendingBoxIds, onOpenBox, onViewAllBoxes, onSignUp }: { boxes: MysteryBox[]; trendingBoxIds: string[]; onOpenBox: (boxId: string) => void; onViewAllBoxes: () => void; onSignUp: () => void }) => {
  const { isAuthenticated, openAuthModal, setView, user } = useGame();
  const [activeLiveWinIndex, setActiveLiveWinIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<HomeTabId>('all');
  const [customerReviews, setCustomerReviews] = useState<MobileCustomerReview[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [submitReviewFile, setSubmitReviewFile] = useState<File | null>(null);
  const [submitReviewCaption, setSubmitReviewCaption] = useState('');
  const [submitReviewNotice, setSubmitReviewNotice] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const cards = boxes.slice(0, 6);
  const originals = cards.length ? cards.slice(0, 3) : [];
  const quickCases = useMemo(() => boxes.slice(0, 6), [boxes]);
  const homeGridBoxes = useMemo(() => {
    const withCoins = boxes.map((box) => ({ box, coins: toCoins(box.price, PRICE_UNIT_MODE), tags: getBoxTags(box) }));
    let list = withCoins;
    switch (activeTab) {
      case 'new':
        list = [...withCoins].sort((a, b) => (b.box.createdAt ?? 0) - (a.box.createdAt ?? 0));
        break;
      case 'popular':
        list = [...withCoins].sort((a, b) => {
          const aScore = a.tags.some((tag) => tag === 'popular' || tag === 'top' || tag === 'hot') ? 1 : 0;
          const bScore = b.tags.some((tag) => tag === 'popular' || tag === 'top' || tag === 'hot') ? 1 : 0;
          return bScore - aScore || b.coins - a.coins;
        });
        break;
      case 'premium':
        list = [...withCoins].sort((a, b) => b.coins - a.coins);
        break;
      case 'budget':
        list = withCoins.filter(({ coins }) => coins < 500);
        break;
      default:
        list = withCoins;
    }
    return list.slice(0, 10).map(({ box }) => box);
  }, [boxes, activeTab]);
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

  const handleClaimFreeBox = () => {
    if (!isAuthenticated) {
      onSignUp();
      return;
    }
    onViewAllBoxes();
  };

  const handleReferFriend = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setView({ type: 'REFERRALS' });
  };

  const scrollToHowItWorks = () => {
    if (typeof document === 'undefined') return;
    document.getElementById('mobile-how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <style>{`
        @keyframes hero-coin-rain { 0% { transform: translate3d(0,-140%,0) rotate(0deg); opacity: 0; } 12% { opacity: .9; } 82% { opacity: .78; } 100% { transform: translate3d(18px,260px,0) rotate(320deg); opacity: 0; } }
        @keyframes pullz-hero-float { 50% { transform: translateY(-10px); } }
        .pullz-hero-box { animation: pullz-hero-float 4.2s ease-in-out infinite; filter: drop-shadow(0 25px 28px rgba(0,0,0,.48)); }
        .pullz-hero-box .pullz-box-item { position:absolute; width:34px; height:50px; border-radius:6px; box-shadow:0 9px 18px rgba(0,0,0,.25); }
        .pullz-hero-box .pullz-box-item:nth-child(1){ left:2px; top:-34px; transform:rotate(-18deg); background:linear-gradient(145deg,#d1d1d7,#676873); }
        .pullz-hero-box .pullz-box-item:nth-child(2){ left:44px; top:-44px; background:linear-gradient(145deg,#a950ff,#3c2454); }
        .pullz-hero-box .pullz-box-item:nth-child(3){ right:2px; top:-34px; transform:rotate(17deg); background:linear-gradient(145deg,#ffbecf,#7d3d75); }
        .pullz-hero-box .pullz-box-body { position:absolute; inset:0; clip-path:polygon(9% 0,91% 0,100% 15%,92% 100%,8% 100%,0 15%); background: linear-gradient(90deg,transparent 0 19%,rgba(255,255,255,.13) 20% 24%,transparent 25% 46%,rgba(255,255,255,.11) 47% 51%,transparent 52% 76%,rgba(255,255,255,.11) 77% 81%,transparent 82%), linear-gradient(145deg,#5c606a,#292b34 72%); }
        .pullz-hero-box .pullz-box-body::before { content:""; position:absolute; left:14px; right:14px; top:26px; height:16px; background:linear-gradient(90deg,#6b3ce9,#a55eff); box-shadow:0 0 14px rgba(117,64,237,.56); }
        .pullz-referral-art { clip-path:polygon(9% 0,91% 0,100% 15%,92% 100%,8% 100%,0 15%); background: linear-gradient(90deg,transparent 0 18%,rgba(255,255,255,.13) 19% 23%,transparent 24% 44%,rgba(255,255,255,.11) 45% 49%,transparent 50% 70%,rgba(255,255,255,.11) 71% 75%,transparent 76%), linear-gradient(145deg,#6d41ee,#29243d 70%); box-shadow:0 0 25px rgba(117,64,237,.36); }
        .pullz-referral-art::before { content:"\\2197"; position:absolute; inset:0; display:grid; place-items:center; font-size:34px; font-weight:1000; color:#c9a7ff; }
      `}</style>

      <section className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-4 lg:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickCases.map((box, index) => (
            <button
              key={box.id}
              type="button"
              onClick={() => onOpenBox(box.id)}
              className="grid min-w-[150px] shrink-0 grid-cols-[38px_1fr_auto] items-center gap-2 rounded-xl border border-white/[0.075] bg-[#14131c] p-2 text-left transition-transform duration-150 hover:-translate-y-0.5"
            >
              <span className={`grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-lg ${QUICK_CASE_GRADIENTS[index % QUICK_CASE_GRADIENTS.length]}`}>
                {box.image ? <img src={box.image} alt="" className="h-7 w-7 object-contain" loading="lazy" decoding="async" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-black text-white">{box.name}</span>
                <span className="mt-0.5 block truncate text-[8px] font-bold text-[#777482]">{getQuickCaseSubtitle(box)}</span>
              </span>
              <CoinAmount amount={Math.round(toCoins(box.price, PRICE_UNIT_MODE))} className="shrink-0 text-[9px] font-black text-[#d6d1df]" iconClassName="h-2.5 w-2.5" animated={false} />
            </button>
          ))}
        </div>
      </section>

      <section className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-4 lg:px-6">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-2.5 sm:grid-cols-[1.35fr_.82fr] sm:gap-3">
          <article className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[radial-gradient(circle_at_72%_45%,rgba(131,58,244,.36),transparent_34%),linear-gradient(135deg,#24163a,#17131f_72%)] p-5 shadow-[0_28px_70px_rgba(0,0,0,.42)] sm:p-7 lg:p-9">
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((coinIndex) => (
                <Coins
                  key={`hero-raining-coin-${coinIndex}`}
                  className="absolute h-4 w-4 animate-[hero-coin-rain_5.8s_linear_infinite] text-amber-300/70 drop-shadow-[0_8px_12px_rgba(0,0,0,0.26)] sm:h-6 sm:w-6"
                  style={{
                    left: `${8 + ((coinIndex * 11) % 86)}%`,
                    animationDelay: `${coinIndex * -0.6}s`,
                    animationDuration: `${5.2 + (coinIndex % 4) * 0.55}s`,
                    transform: `rotate(${coinIndex * 23}deg)`
                  }}
                />
              ))}
            </div>
            <div className="relative z-10 max-w-[380px]">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#854bff]/24 bg-[#7540ed]/13 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-[#d8c4ff]">
                <Gift className="h-3 w-3" />{isAuthenticated ? 'Boxes refreshed daily' : 'Free first box available'}
              </div>
              <h1 className="mt-3 max-w-[300px] text-[26px] font-black leading-[0.98] tracking-tight text-white sm:text-[36px] lg:text-[46px]">
                {isAuthenticated ? 'Open your next Pullz box.' : 'Sign up and claim your first Pullz box.'}
              </h1>
              <p className="mt-3 max-w-[360px] text-[11px] leading-relaxed text-[#b1acbb] sm:text-xs">
                Open curated cases containing real graded cards. Keep the item in your vault, request tracked shipping, or sell it back for coins.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={handleClaimFreeBox} className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-[linear-gradient(135deg,#8e4df7,#6635dd)] px-4 text-[10px] font-black uppercase text-white shadow-[0_12px_28px_rgba(101,52,221,.25)]">Claim Free Box</button>
                <button type="button" onClick={scrollToHowItWorks} className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-white/[0.14] bg-white/[0.03] px-4 text-[10px] font-black uppercase text-white">How Pullz Works</button>
              </div>
            </div>
            <div className="pullz-hero-box absolute bottom-3 right-1/2 hidden h-[128px] w-[165px] translate-x-1/2 sm:right-6 sm:block sm:h-[130px] sm:w-[168px] sm:translate-x-0 lg:right-9 lg:h-[152px] lg:w-[195px]" aria-hidden="true">
              <div className="relative h-full w-full">
                <span className="pullz-box-item" />
                <span className="pullz-box-item" />
                <span className="pullz-box-item" />
                <div className="pullz-box-body" />
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[radial-gradient(circle_at_74%_35%,rgba(142,63,246,.33),transparent_37%),linear-gradient(135deg,#24173b,#17131f)] p-5 sm:p-6">
            <h2 className="max-w-[235px] text-lg font-black leading-tight tracking-tight text-white sm:text-xl">Earn rewards when friends join.</h2>
            <p className="mt-2.5 max-w-[210px] text-[11px] leading-relaxed text-[#aaa5b2]">Share your code and earn bonus coins after qualifying activity.</p>
            <button type="button" onClick={handleReferFriend} className="mt-4 inline-flex min-h-[38px] items-center justify-center rounded-lg bg-[linear-gradient(135deg,#8e4df7,#6635dd)] px-4 text-[10px] font-black uppercase text-white shadow-[0_12px_28px_rgba(101,52,221,.25)]">Refer a Friend</button>
            <div className="pullz-referral-art absolute bottom-3 right-3 hidden h-[80px] w-[100px] sm:block" aria-hidden="true" />
          </article>
        </div>
      </section>

      <section className="pullz-home-trust-grid mt-5 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Ship Real Items', sublabel: 'To Your Door', icon: Truck },
            { label: 'Provably Fair', sublabel: 'Verified Results', icon: ShieldCheck },
            { label: 'Instant Sellback', sublabel: 'Get Coins Fast', icon: Zap },
            { label: 'Secure Payments', sublabel: 'Instant Delivery', icon: CreditCard }
          ].map(({ label, sublabel, icon: Icon }) => (
            <div key={label} className="flex h-[72px] min-w-0 flex-col items-center justify-center rounded-[1rem] border border-white/[0.075] bg-[#12111a] text-center shadow-[inset_0_0_18px_rgba(255,255,255,0.025),0_10px_20px_rgba(0,0,0,0.16)]" aria-label={`${label}: ${sublabel}`}>
              <Icon className="mb-1.5 h-5 w-5 text-[#37ed86]" strokeWidth={2.2} aria-hidden="true" />
              <span className="text-[10px] font-black uppercase leading-none tracking-tight text-white sm:text-[13px]">{label}</span>
              <span className="mt-0.5 text-[7px] font-black uppercase tracking-wide text-[#37ed86]">{sublabel}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="mobile-trending-boxes" className="pullz-home-trending-grid scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {HOME_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[9px] font-black uppercase transition-colors ${activeTab === tab.id ? 'border-[#7540ed]/50 bg-[#7540ed]/20 text-white' : 'border-white/[0.075] bg-[#12111a] text-[#8e8a96]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onViewAllBoxes} className="shrink-0 text-[10px] font-black uppercase text-[#aba6b4]">View all boxes →</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {(homeGridBoxes.length ? homeGridBoxes : Array.from({ length: 10 }) as MysteryBox[]).map((box, index) => {
            if (!box) {
              return <div key={`trending-loading-${index}`} className="h-[220px] animate-pulse rounded-xl bg-[#171621] sm:h-[240px]" aria-hidden="true" />;
            }
            const label = getHomeCardLabel(box);
            return (
              <div
                key={box.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenBox(box.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenBox(box.id); } }}
                className="group relative flex h-[220px] cursor-pointer flex-col overflow-hidden rounded-xl border border-white/[0.075] bg-[#15141d] p-2.5 text-left transition-transform duration-150 hover:-translate-y-1 sm:h-[240px]"
              >
                {label ? <span className={`absolute left-2 top-2 z-20 rounded px-1.5 py-0.5 text-[7px] font-black uppercase ${label.className}`}>{label.text}</span> : null}
                <div className="relative z-10 flex flex-1 items-center justify-center rounded-lg bg-[#171621]">
                  <img src={box.image} alt="" width={140} height={140} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" className="h-[86px] w-full object-contain transition-transform duration-200 group-hover:scale-105 sm:h-[96px]" />
                </div>
                <h3 className="mt-2 truncate text-[10px] font-bold text-white sm:text-[11px]">{box.name}</h3>
                <div className="mt-1 flex items-center justify-between gap-2 text-[#777482]">
                  <span className="text-[8px] font-bold">{box.items.length} possible pulls</span>
                  <CoinAmount amount={Math.round(toCoins(box.price, PRICE_UNIT_MODE))} className="text-[9px] font-black text-white" iconClassName="h-2.5 w-2.5" animated={false} />
                </div>
                <div className="mt-2 w-full rounded-lg bg-[linear-gradient(135deg,#7843ef,#5c31ca)] py-1.5 text-center text-[8px] font-black uppercase text-white">Open Box</div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="mobile-live-wins" className="pullz-home-live-wins scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Live Wins</h2></div>
          <div className="flex gap-2"><button className="grid h-8 w-8 place-items-center rounded-full bg-[#12111a] text-slate-500"><ChevronLeft className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded-full bg-[#12111a] text-slate-400"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-2 transition-transform duration-700 ease-out" style={{ transform: `translate3d(-${activeLiveWinIndex * 108}px,0,0)` }}>
            {(displayedLiveWins.length ? displayedLiveWins.map((win, index) => ({ ...win, id: `${win.id}-${index}` })) : originals.map((box, index) => ({ id: box.id, title: box.name, image: box.image, rarity: (index === 0 ? 'rare' : index === 1 ? 'uncommon' : 'epic') as MobileLiveWin['rarity'], timeAgo: index === 0 ? 'now' : `${index + 1}m`, boxId: box.id }))).map((win) => <MobileLiveWinCard key={win.id} win={win} onOpenBox={onOpenBox} />)}
            {!displayedLiveWins.length && !originals.length ? Array.from({ length: 6 }).map((_, index) => <div key={`live-win-loading-${index}`} className="h-[128px] min-w-[100px] animate-pulse rounded-md bg-[#171621]" aria-hidden="true" />) : null}
          </div>
        </div>
      </section>

      <section id="mobile-customer-reviews" className="pullz-home-reviews scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Fresh Deliveries</h2></div>
          <button type="button" onClick={handleSubmitReview} aria-label="Submit your pull, get 50 coins" className="inline-flex w-full flex-wrap items-center justify-center gap-1.5 rounded-full bg-[#12111a] px-3 py-2 text-[10px] font-black uppercase text-slate-200 active:scale-[0.98] sm:w-auto sm:flex-nowrap">
            <span>Submit Your Pull, Get</span>
            <span className="inline-flex items-center gap-1 text-[#37ed86]"><img src={COIN_ICON} alt="" className="h-3.5 w-3.5" loading="lazy" decoding="async" />50</span>
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
            <article key={step.title} className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[#12111a] p-4 shadow-[inset_0_0_18px_rgba(255,255,255,0.025),0_10px_20px_rgba(0,0,0,0.16)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(55,237,134,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]" />
              <div className="relative z-10 flex items-start gap-3 sm:flex-col">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#171621] text-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.075)]" aria-hidden="true">{step.icon}</span>
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
            <label className="block rounded-xl border border-dashed border-[#37ed86]/50 bg-black/20 p-4 text-center text-sm font-bold text-slate-200">
              {submitReviewFile ? submitReviewFile.name : 'Tap to add an image'}
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => setSubmitReviewFile(event.target.files?.[0] ?? null)} />
            </label>
            <textarea value={submitReviewCaption} onChange={(event) => setSubmitReviewCaption(event.target.value)} placeholder="Caption (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-[#0d1220] p-3 text-sm text-white" />
            {submitReviewNotice && <p className="mt-2 text-sm font-bold text-[#37ed86]">{submitReviewNotice}</p>}
            <button type="submit" disabled={isSubmittingReview} className="mt-3 w-full rounded-xl bg-[#37ed86] px-4 py-3 text-sm font-black uppercase text-[#062011] disabled:opacity-60">{isSubmittingReview ? 'Submitting...' : 'Submit for review'}</button>
          </form>
        </div>
      )}
    </div>
  );
};

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, trendingBoxIds = [], onOpenBox, onViewAllBoxes, onSignUp }) => {
  return (
    <div className="pullz-home-shell min-h-screen bg-[#0b0a11] text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} trendingBoxIds={trendingBoxIds} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} onSignUp={onSignUp} />
      </main>
    </div>
  );
};
