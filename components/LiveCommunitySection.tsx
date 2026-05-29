import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp, collection, doc, getDoc, increment, limit, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../firebase';

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
  const sectionRef = useRef<HTMLElement | null>(null);
  const [stories, setStories] = useState<LiveCommunityStory[]>([]);
  const [shouldConnectRealtime, setShouldConnectRealtime] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const holdRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [storyDragOffset, setStoryDragOffset] = useState(0);
  const viewedStoryIdsRef = useRef<Set<string>>(new Set());
  const [brokenStoryIds, setBrokenStoryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let io: IntersectionObserver | null = null;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
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
    else timeoutId = window.setTimeout(activate, 3500);
    return () => {
      io?.disconnect();
      if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

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
          .slice(0, 30);
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

  return <section ref={sectionRef} className="space-y-4 min-h-[120px]">
    <div className="">
      <div className="flex justify-end px-1 py-1">
        <button className="text-sm font-semibold text-slate-300 hover:text-white">View All</button>
      </div>
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-0 py-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:auto]">
        {stories.length ? stories.map((story, index) => (
          <button
            key={story.id}
            onClick={() => { void handleOpenStory(index); }}
            className="group flex w-[132px] shrink-0 snap-start flex-col items-center text-center sm:w-[140px]"
          >
            <div className="relative h-[118px] w-[118px] overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 p-[2px] shadow-[0_0_24px_rgba(92,101,255,0.45)] transition-transform duration-200 group-hover:scale-105 sm:h-[126px] sm:w-[126px]">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#080a12]">
                <img
                  src={story.mediaUrl}
                  alt={story.caption || 'Live community story'}
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover"
                  onError={() => { void handleStoryImageError(story); }}
                />
              </div>
            </div>
          </button>
        )) : Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="relative h-[118px] w-[118px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] sm:h-[126px] sm:w-[126px]"><div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" /></div>)}
      </div>
    </div>
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
              className="absolute inset-y-0 left-0 w-1/3 bg-transparent"
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
              className="absolute inset-y-0 right-0 w-1/3 bg-transparent"
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
