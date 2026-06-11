import React, { useEffect, useRef, useState } from 'react';
import { Timestamp, addDoc, collection, doc, getDoc, increment, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { COIN_ICON } from '../constants';
import { useGame } from '../context/GameContext';
import type { User } from '../types';

export type LiveCommunityStory = {
  id: string;
  type: string;
  username: string;
  caption: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  rarity: string;
  featured: boolean;
  createdAt?: Timestamp;
  publishAt?: Timestamp;
  expiresAt?: Timestamp;
  approved: boolean;
  views: number;
  clicks: number;
  order: number;
  badgeText?: string;
  showViewCount?: boolean;
  linkUrl?: string;
  timestampLabel?: string;
  hidden?: boolean;
};




const STORY_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=70';

const resolveMediaUrl = async (story: LiveCommunityStory): Promise<string> => {
  const rawUrl = typeof story.mediaUrl === 'string' ? story.mediaUrl.trim() : '';
  if (rawUrl.startsWith('gs://')) return getDownloadURL(ref(storage, rawUrl));
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;

  const snapshot = await getDoc(doc(db, 'liveCommunityStories', story.id));
  if (snapshot.exists()) {
    const data = snapshot.data() as Record<string, unknown>;
    const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
    if (storagePath) return getDownloadURL(ref(storage, storagePath));
  }

  return rawUrl;
};
const rarityRing: Record<string, string> = {
  common: 'from-slate-400/70 to-cyan-500/70',
  rare: 'from-sky-400/80 to-violet-500/80',
  epic: 'from-fuchsia-400/80 to-violet-500/80',
  legendary: 'from-amber-300/90 to-orange-500/90'
};

const getStoryBadge = (story: LiveCommunityStory) => {
  const raw = `${story.badgeText ?? ''} ${story.type ?? ''} ${story.rarity ?? ''}`.toLowerCase();
  if (raw.includes('deliver') || raw.includes('shipment')) return 'Delivered';
  if (raw.includes('big') || raw.includes('hit') || raw.includes('legendary') || raw.includes('psa')) return 'Big Win';
  return 'Pull';
};

const storyBadgeClass: Record<string, string> = {
  Pull: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
  Delivered: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  'Big Win': 'border-amber-300/30 bg-amber-300/12 text-amber-100'
};

const formatStoryCount = (count: number) => `${count} ${count === 1 ? 'story' : 'stories'}`;


const getSubmissionUsername = (user: User): string => {
  const rawName = user.username || user.displayName || user.name || user.email?.split('@')[0] || '';
  return rawName.trim().replace(/^@+/, '');
};


const toMillis = (value: unknown): number => {
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Number((value as { toMillis: () => number }).toMillis());
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
};

const formatStoryTimeLabel = (story: LiveCommunityStory): string => {
  const source = (story as Record<string, unknown>).publishAt ?? story.createdAt;
  const millis = toMillis(source);
  if (!millis) return 'just now';
  const diffMs = Date.now() - millis;
  if (diffMs < 60_000) return 'now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};
export const LiveCommunitySection: React.FC = () => {
  const { user, isAuthenticated, openAuthModal } = useGame();
  const sectionRef = useRef<HTMLElement | null>(null);
  const storyRailRef = useRef<HTMLDivElement | null>(null);
  const [stories, setStories] = useState<LiveCommunityStory[]>([]);
  const [shouldConnectRealtime, setShouldConnectRealtime] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const holdRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [storyDragOffset, setStoryDragOffset] = useState(0);
  const viewedStoryIdsRef = useRef<Set<string>>(new Set());
  const [brokenStoryIds, setBrokenStoryIds] = useState<Set<string>>(new Set());
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitUsername, setSubmitUsername] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitPreviewUrl, setSubmitPreviewUrl] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingPull, setIsSubmittingPull] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || submitUsername.trim()) return;
    const accountUsername = getSubmissionUsername(user);
    if (accountUsername) setSubmitUsername(accountUsername);
  }, [isAuthenticated, submitUsername, user]);

  const scrollStoryRail = (direction: 'previous' | 'next') => {
    const rail = storyRailRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>('[data-community-story-card]');
    const cardWidth = card?.offsetWidth ?? 104;
    const gap = 12;
    rail.scrollBy({ left: (cardWidth + gap) * (direction === 'next' ? 2 : -2), behavior: 'smooth' });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let io: IntersectionObserver | null = null;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const activate = () => setShouldConnectRealtime(true);
    if ('IntersectionObserver' in window && sectionRef.current) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate();
          io?.disconnect();
        }
      }, { rootMargin: '240px 0px' });
      io.observe(sectionRef.current);
    }
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(activate, { timeout: 3500 }) as unknown as number;
    else timeoutId = globalThis.setTimeout(activate, 3500);
    return () => {
      io?.disconnect();
      if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!submitFile) {
      setSubmitPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(submitFile);
    setSubmitPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [submitFile]);

  useEffect(() => {
    if (!shouldConnectRealtime) return;
    const q = query(collection(db, 'liveCommunityStories'), where('approved', '==', true), limit(50));

    return onSnapshot(
      q,
      (snap) => {
        const nowMs = Date.now();
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<LiveCommunityStory, 'id'>) }))
          .filter((story) => !story.hidden && Boolean(story.mediaUrl))
          .filter((story) => {
            const publishAt = story.publishAt as Timestamp | undefined;
            const publishMs = publishAt && typeof publishAt.toMillis === 'function' ? publishAt.toMillis() : 0;
            return publishMs <= nowMs;
          })
          .sort((a, b) => {
            if (a.featured !== b.featured) return a.featured ? -1 : 1;
            const aOrder = Number.isFinite(a.order) ? a.order : 9999;
            const bOrder = Number.isFinite(b.order) ? b.order : 9999;
            return aOrder - bOrder;
          })
          .slice(0, 42);
        setStories(next);
        try { window.localStorage.setItem('liveCommunityStoriesCache', JSON.stringify(next)); } catch {}
      },
      () => {
        let cached: LiveCommunityStory[] = [];
        try {
          const raw = window.localStorage.getItem('liveCommunityStoriesCache');
          if (raw) cached = JSON.parse(raw) as LiveCommunityStory[];
        } catch {}
        setStories(cached);
      }
    );
  }, [shouldConnectRealtime]);

  useEffect(() => {
    if (activeIndex === null || holdRef.current) return;
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 2)), 80);
    return () => window.clearInterval(id);
  }, [activeIndex]);

  useEffect(() => {
    if (progress < 100 || activeIndex === null) return;
    if (activeIndex >= stories.length - 1) setActiveIndex(null);
    else setActiveIndex((v) => (v === null ? 0 : v + 1));
    setProgress(0);
  }, [progress, activeIndex, stories.length]);



  const handleStoryImageError = async (story: LiveCommunityStory) => {
    if (brokenStoryIds.has(story.id)) return;
    setBrokenStoryIds((current) => new Set(current).add(story.id));
    try {
      const resolved = await resolveMediaUrl(story);
      if (resolved && resolved !== story.mediaUrl) {
        setStories((current) => current.map((entry) => (entry.id === story.id ? { ...entry, mediaUrl: resolved } : entry)));
        return;
      }
    } catch {}
    setStories((current) => current.map((entry) => (entry.id === story.id ? { ...entry, mediaUrl: STORY_IMAGE_FALLBACK } : entry)));
  };

  const closeStory = () => {
    holdRef.current = false;
    touchStartRef.current = null;
    setStoryDragOffset(0);
    setActiveIndex(null);
  };

  const handleStoryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    holdRef.current = true;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setStoryDragOffset(0);
  };

  const handleStoryTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      event.preventDefault();
      setStoryDragOffset(Math.min(deltaY, 180));
    }
  };

  const handleStoryTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    holdRef.current = false;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) {
      setStoryDragOffset(0);
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      setStoryDragOffset(0);
      return;
    }

    const deltaY = touch.clientY - start.y;
    const deltaX = touch.clientX - start.x;
    const elapsed = Math.max(Date.now() - start.time, 1);
    const velocity = deltaY / elapsed;
    if (deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX) && velocity > 0.25) {
      closeStory();
      return;
    }

    if (Math.abs(deltaX) > 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      setProgress(0);
      setActiveIndex((current) => {
        if (current === null) return current;
        if (deltaX < 0) return current >= stories.length - 1 ? null : current + 1;
        return Math.max(0, current - 1);
      });
      setStoryDragOffset(0);
      return;
    }

    setStoryDragOffset(0);
  };

  const handleOpenStory = async (index: number) => {
    const story = stories[index];
    if (!story) return;
    setActiveIndex(index);
    setProgress(0);
    setStoryDragOffset(0);

    if (viewedStoryIdsRef.current.has(story.id)) return;
    viewedStoryIdsRef.current.add(story.id);

    try {
      await updateDoc(doc(db, 'liveCommunityStories', story.id), { views: increment(1) });
    } catch {
      viewedStoryIdsRef.current.delete(story.id);
    }
  };

  const openSubmitPull = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    const accountUsername = getSubmissionUsername(user);
    if (accountUsername) setSubmitUsername(accountUsername);
    setSubmitNotice(null);
    setIsSubmitOpen(true);
  };

  const closeSubmitPull = () => {
    if (isSubmittingPull) return;
    setIsSubmitOpen(false);
    setSubmitNotice(null);
  };

  const resetSubmitForm = () => {
    setSubmitUsername('');
    setSubmitFile(null);
  };

  const handleSubmitPull = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingPull) return;

    if (!isAuthenticated) {
      setIsSubmitOpen(false);
      openAuthModal('login');
      return;
    }

    const trimmedUsername = submitUsername.trim();
    if (trimmedUsername.length < 2) {
      setSubmitNotice({ tone: 'error', message: 'Add the username you want shown with your pull.' });
      return;
    }

    if (!submitFile) {
      setSubmitNotice({ tone: 'error', message: 'Upload a clean photo of your delivered pull.' });
      return;
    }

    if (!submitFile.type.startsWith('image/')) {
      setSubmitNotice({ tone: 'error', message: 'Please upload an image file.' });
      return;
    }

    setIsSubmittingPull(true);
    setSubmitNotice(null);
    try {
      const safeName = submitFile.name.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
      const uploadPath = `live-community-submissions/${Date.now()}-${safeName}`;
      const uploadRef = ref(storage, uploadPath);
      await uploadBytes(uploadRef, submitFile, { contentType: submitFile.type || 'image/jpeg' });
      const mediaUrl = await getDownloadURL(uploadRef);

      await addDoc(collection(db, 'liveCommunityStories'), {
        username: trimmedUsername,
        caption: 'Community pull submission',
        badgeText: 'Delivered',
        type: 'shipment',
        rarity: 'rare',
        featured: false,
        approved: false,
        status: 'pending',
        mediaUrl,
        mediaType: 'image',
        storagePath: uploadPath,
        source: 'community-submit-pull',
        rewardCoins: 1000,
        requirements: ['shipped_and_delivered', 'clean_respectful_photo', 'admin_approved'],
        createdAt: serverTimestamp(),
        order: Date.now(),
        views: 0,
        clicks: 0,
        hidden: false
      });

      resetSubmitForm();
      setSubmitNotice({ tone: 'success', message: 'Submitted! Our admins will review it before it appears and reward eligibility is confirmed.' });
    } catch (error) {
      setSubmitNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to submit your pull right now.' });
    } finally {
      setIsSubmittingPull(false);
    }
  };

  const canNavigateStories = stories.length > 1;

  return <section ref={sectionRef} className="space-y-3 min-h-[136px]">
    <div className="rounded-[1.1rem] border border-white/[0.06] bg-[#20262b]/62 p-3 shadow-[0_16px_40px_rgba(5,8,12,0.18)] sm:p-4">
      <div className="mb-2.5 flex items-end justify-between gap-2 px-0.5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/85">Community Pullz</p>
          <h2 className="mt-0.5 text-xl font-black tracking-tight text-white sm:text-2xl">Real wins &amp; deliveries</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300 sm:inline-flex">{formatStoryCount(stories.length)}</span>
          <div className="hidden items-center gap-1 sm:flex" aria-label="Scroll community stories">
            <button type="button" aria-label="Scroll to previous community stories" onClick={() => scrollStoryRail('previous')} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-base font-black text-white/90 transition hover:border-fuchsia-300/40 hover:bg-white/[0.08]">‹</button>
            <button type="button" aria-label="Scroll to next community stories" onClick={() => scrollStoryRail('next')} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-base font-black text-white/90 transition hover:border-fuchsia-300/40 hover:bg-white/[0.08]">›</button>
          </div>
          <button className="min-h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white/90 transition hover:border-fuchsia-300/40 hover:bg-white/[0.08] hover:text-white">View All</button>
        </div>
      </div>
      <div className="relative -mx-4 sm:mx-0">
        <div className="pointer-events-none absolute inset-y-2 left-0 z-10 w-8 bg-gradient-to-r from-[#20262b] to-transparent sm:hidden" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-y-2 right-0 z-10 w-8 bg-gradient-to-l from-[#20262b] to-transparent sm:hidden" aria-hidden="true" />
        <div
          ref={storyRailRef}
          className="scrollbar-hide flex snap-x snap-proximity gap-2.5 overflow-x-auto overscroll-x-contain px-4 py-1.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x] sm:gap-3 sm:px-0.5"
          aria-label="Community Pullz stories. Swipe horizontally to browse."
        >
          <button
            type="button"
            onClick={openSubmitPull}
            data-community-story-card
            className="group flex w-[96px] shrink-0 snap-start touch-pan-x flex-col items-center text-center sm:w-[112px] lg:w-[120px]"
          >
            <div className="relative grid h-[86px] w-[86px] place-items-center overflow-hidden rounded-full border border-amber-200/35 bg-gradient-to-br from-amber-300/95 via-lime-300/90 to-emerald-300/90 p-[2px] shadow-[0_0_20px_rgba(250,204,21,0.28)] transition-transform duration-200 group-hover:scale-105 group-active:scale-[0.98] sm:h-[100px] sm:w-[100px] lg:h-[108px] lg:w-[108px]">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0b1010]/92 px-2 text-center">
                <img src={COIN_ICON} alt="" aria-hidden="true" className="mb-1 h-6 w-6 object-contain drop-shadow sm:h-7 sm:w-7" loading="lazy" decoding="async" />
                <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-white sm:text-[10px]">Submit Pull</span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-black text-black">
                  +1,000
                </span>
              </div>
            </div>
            <span className="mt-1.5 max-w-full truncate text-[11px] font-bold text-amber-100">Get 1,000 coins</span>
          </button>
        {stories.length ? stories.map((story, index) => {
          const badge = getStoryBadge(story);
          return (
          <button
            key={story.id}
            onClick={() => { void handleOpenStory(index); }}
            data-community-story-card
            className="group flex w-[96px] shrink-0 snap-start touch-pan-x flex-col items-center text-center sm:w-[112px] lg:w-[120px]"
          >
            <div className={`relative h-[86px] w-[86px] overflow-hidden rounded-full bg-gradient-to-br ${rarityRing[story.rarity] ?? 'from-fuchsia-500 via-violet-500 to-sky-500'} p-[2px] shadow-[0_0_18px_rgba(92,101,255,0.38)] transition-transform duration-200 group-hover:scale-105 group-active:scale-[0.98] sm:h-[100px] sm:w-[100px] lg:h-[108px] lg:w-[108px]`}>
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#080a12]">
                <img
                  src={story.mediaUrl}
                  alt={story.caption || `${story.username} community story`}
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover"
                  onError={() => { void handleStoryImageError(story); }}
                />
              </div>
              <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wide backdrop-blur-md ${storyBadgeClass[badge]}`}>{badge}</span>
            </div>
            <span className="mt-1.5 max-w-full truncate text-[11px] font-bold text-slate-200">@{story.username || 'pullz'}</span>
          </button>
        );}) : Array.from({ length: 10 }).map((_, idx) => <div key={idx} className="relative h-[86px] w-[86px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] sm:h-[100px] sm:w-[100px] lg:h-[108px] lg:w-[108px]"><div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" /></div>)}
        </div>
      </div>
    </div>
    {isSubmitOpen && (
      <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/75 px-3 pb-3 pt-10 backdrop-blur-sm sm:items-center sm:p-6" onClick={closeSubmitPull}>
        <form
          className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#10151b] text-white shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => { void handleSubmitPull(event); }}
        >
          <div className="relative border-b border-white/10 bg-gradient-to-br from-amber-300/16 via-lime-300/8 to-fuchsia-400/10 p-4 sm:p-5">
            <button type="button" aria-label="Close submit pull modal" onClick={closeSubmitPull} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/20 text-lg font-bold text-white/80 transition hover:bg-white/10">×</button>
            <div className="flex items-center gap-3 pr-10">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-200/30 bg-amber-300/12">
                <img src={COIN_ICON} alt="Coins" className="h-8 w-8 object-contain" loading="lazy" decoding="async" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/80">Community reward</p>
                <h3 className="mt-0.5 text-xl font-black leading-tight text-white">Submit your pull, get 1,000 coins</h3>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {submitNotice && <div className={`rounded-2xl border px-3 py-2 text-sm ${submitNotice.tone === 'success' ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-red-300/30 bg-red-400/10 text-red-100'}`}>{submitNotice.message}</div>}

            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-300">Username</span>
              <input
                value={submitUsername}
                onChange={(event) => setSubmitUsername(event.target.value)}
                placeholder="@yourname"
                className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-amber-200/50 focus:bg-white/[0.07]"
                maxLength={32}
              />
            </label>

            <label className="block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-3 transition hover:border-amber-200/40 hover:bg-white/[0.055]">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-300">Photo of delivered pull</span>
              <div className="flex items-center gap-3">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {submitPreviewUrl ? <img src={submitPreviewUrl} alt="Submission preview" className="h-full w-full object-cover" /> : 'Add photo'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{submitFile ? submitFile.name : 'Tap to upload an image'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Use a clear, respectful photo of an order that has already been delivered.</p>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => setSubmitFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/18 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-300">Requirements</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-300">
                <li>• Order must be shipped and delivered.</li>
                <li>• Clean, respectful photos only.</li>
                <li>• Must be admin approved before posting/reward.</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={isSubmittingPull}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-lime-300 to-emerald-300 px-4 text-sm font-black uppercase tracking-wide text-black shadow-[0_14px_34px_rgba(132,204,22,0.22)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img src={COIN_ICON} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
              {isSubmittingPull ? 'Submitting...' : 'Submit for 1,000 coins'}
            </button>
          </div>
        </form>
      </div>
    )}
    {activeIndex !== null && stories[activeIndex] && (
      <div className="fixed inset-0 z-[220] bg-black/95 backdrop-blur-sm" onClick={closeStory}>
        <div
          className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col px-3 py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleStoryTouchStart}
          onTouchMove={handleStoryTouchMove}
          onTouchEnd={handleStoryTouchEnd}
          style={{ transform: storyDragOffset ? `translateY(${storyDragOffset}px)` : undefined, transition: storyDragOffset ? undefined : 'transform 180ms ease-out' }}
        >
          <div className="mb-3 flex gap-1.5">{stories.map((_, idx) => <div key={idx} className="h-1 flex-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-white" style={{ width: `${idx < activeIndex ? 100 : idx === activeIndex ? progress : 0}%` }} /></div>)}</div>
          <div className="mb-3 flex items-center justify-between gap-3 text-sm text-white"><span className="min-w-0 truncate font-semibold">{stories[activeIndex].username} · {stories[activeIndex].timestampLabel ?? formatStoryTimeLabel(stories[activeIndex])}</span><button type="button" aria-label="Close story" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-bold text-white transition hover:bg-white/20" onClick={closeStory}>✕</button></div>
          <div className="relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#080a12] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-8rem)] sm:rounded-[2rem]" onMouseDown={() => { holdRef.current = true; }} onMouseUp={() => { holdRef.current = false; }} onMouseLeave={() => { holdRef.current = false; }}>
            {stories[activeIndex].mediaType === 'video' ? <video src={stories[activeIndex].mediaUrl} className="h-full max-h-full w-full object-cover" autoPlay muted playsInline controls /> : <img src={stories[activeIndex].mediaUrl} className="h-full max-h-full w-full object-cover" alt={stories[activeIndex].caption || 'Live community story'} onError={() => { void handleStoryImageError(stories[activeIndex]); }} />}
            <button
              type="button"
              aria-label="Previous story"
              className={`absolute inset-y-0 left-0 w-1/3 bg-transparent ${canNavigateStories ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => {
                setProgress(0);
                setActiveIndex((current) => {
                  if (current === null) return current;
                  if (current <= 0) return 0;
                  return current - 1;
                });
              }}
            />
            <button
              type="button"
              aria-label="Next story"
              className={`absolute inset-y-0 right-0 w-1/3 bg-transparent ${canNavigateStories ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => {
                setProgress(0);
                setActiveIndex((current) => {
                  if (current === null) return current;
                  if (current >= stories.length - 1) return null;
                  return current + 1;
                });
              }}
            />
          </div>
        </div>
      </div>
    )}
  </section>;
};
