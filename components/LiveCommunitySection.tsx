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
  const [stories, setStories] = useState<LiveCommunityStory[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const holdRef = useRef(false);
  const viewedStoryIdsRef = useRef<Set<string>>(new Set());
  const [brokenStoryIds, setBrokenStoryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
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
            const expiresAt = story.expiresAt as Timestamp | undefined;
            const publishMs = publishAt && typeof publishAt.toMillis === 'function' ? publishAt.toMillis() : 0;
            const expiresMs = expiresAt && typeof expiresAt.toMillis === 'function' ? expiresAt.toMillis() : Number.POSITIVE_INFINITY;
            return publishMs <= nowMs && expiresMs > nowMs;
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
  }, []);

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

  const handleOpenStory = async (index: number) => {
    const story = stories[index];
    if (!story) return;
    setActiveIndex(index);
    setProgress(0);

    if (viewedStoryIdsRef.current.has(story.id)) return;
    viewedStoryIdsRef.current.add(story.id);

    try {
      await updateDoc(doc(db, 'liveCommunityStories', story.id), { views: increment(1) });
    } catch {
      viewedStoryIdsRef.current.delete(story.id);
    }
  };

  return <section className="space-y-4">
    <div className="">
      <div className="flex justify-end px-1 py-1">
        <button className="text-sm font-semibold text-slate-300 hover:text-white">View All</button>
      </div>
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-0 py-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:auto]">
        {stories.length ? stories.map((story, index) => (
          <button
            key={story.id}
            onClick={() => { void handleOpenStory(index); }}
            className="group flex w-[86px] shrink-0 snap-start flex-col items-center gap-1.5 text-center"
          >
            <div className="relative h-[74px] w-[74px] rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 p-[2px] shadow-[0_0_18px_rgba(92,101,255,0.35)]">
              <img
                src={story.mediaUrl}
                alt={story.caption || 'Live community story'}
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-full object-cover"
                onError={() => { void handleStoryImageError(story); }}
              />
            </div>
            <p className="max-w-[82px] truncate text-[11px] font-bold text-white">{story.username}</p>
            <p className="text-[10px] text-slate-300">{story.timestampLabel ?? formatStoryTimeLabel(story)}</p>
            {story.showViewCount && <p className="flex items-center gap-1 text-[10px] font-semibold text-white/80"><i className="fa-solid fa-eye text-[9px]" aria-hidden="true" /><span>{Number.isFinite(story.views) ? story.views : 0}</span></p>}
          </button>
        )) : Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="relative h-[86px] w-[86px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.03]"><div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" /></div>)}
      </div>
    </div>
    {activeIndex !== null && stories[activeIndex] && (
      <div className="fixed inset-0 z-[220] bg-black/95" onClick={() => setActiveIndex(null)}>
        <div className="mx-auto flex h-full w-full max-w-md flex-col px-3 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex gap-1">{stories.map((_, idx) => <div key={idx} className="h-1 flex-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-white" style={{ width: `${idx < activeIndex ? 100 : idx === activeIndex ? progress : 0}%` }} /></div>)}</div>
          <div className="mb-2 flex items-center justify-between text-sm text-white"><span>{stories[activeIndex].username} · {stories[activeIndex].timestampLabel ?? formatStoryTimeLabel(stories[activeIndex])}</span><button onClick={() => setActiveIndex(null)}>✕</button></div>
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#111]" onMouseDown={() => { holdRef.current = true; }} onMouseUp={() => { holdRef.current = false; }} onTouchStart={() => { holdRef.current = true; }} onTouchEnd={() => { holdRef.current = false; }}>
            {stories[activeIndex].mediaType === 'video' ? <video src={stories[activeIndex].mediaUrl} className="h-full w-full object-cover" autoPlay muted playsInline /> : <img src={stories[activeIndex].mediaUrl} className="h-full w-full object-cover" alt={stories[activeIndex].caption || 'Live community story'} onError={() => { void handleStoryImageError(stories[activeIndex]); }} />}
            <button
              type="button"
              aria-label="Previous story"
              className="absolute inset-y-0 left-0 w-1/2"
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
              className="absolute inset-y-0 right-0 w-1/2"
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
