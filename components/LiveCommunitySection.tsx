import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp, collection, doc, increment, limit, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

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

const rarityRing: Record<string, string> = {
  common: 'from-slate-400/70 to-cyan-500/70',
  rare: 'from-sky-400/80 to-violet-500/80',
  epic: 'from-fuchsia-400/80 to-violet-500/80',
  legendary: 'from-amber-300/90 to-orange-500/90'
};

export const LiveCommunitySection: React.FC = () => {
  const [stories, setStories] = useState<LiveCommunityStory[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const holdRef = useRef(false);
  const viewedStoryIdsRef = useRef<Set<string>>(new Set());

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
        setLoadError(null);
      },
      (error) => {
        setStories([]);
        setLoadError(error?.message || 'Unable to load live stories right now.');
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

  const trustItems = useMemo(
    () => [
      ['Provably Fair', '100% Transparent'],
      ['Instant Delivery', 'Digital Items'],
      ['Real Shipping', 'Worldwide'],
      ['24/7 Support', "We're here"]
    ],
    []
  );



  const handleOpenStory = async (index: number) => {
    const story = stories[index];
    if (!story) return;
    setActiveIndex(index);
    setProgress(0);

    if (viewedStoryIdsRef.current.has(story.id)) return;
    viewedStoryIdsRef.current.add(story.id);

    setStories((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, views: (entry.views || 0) + 1 } : entry)));

    try {
      await updateDoc(doc(db, 'liveCommunityStories', story.id), { views: increment(1) });
    } catch {
      viewedStoryIdsRef.current.delete(story.id);
      setStories((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, views: Math.max((entry.views || 1) - 1, 0) } : entry)));
    }
  };

  return <section className="space-y-4">
    <div className="">
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" /><h2 className="text-sm font-black tracking-[0.16em] text-white">LIVE COMMUNITY</h2></div>
        <button className="text-sm font-semibold text-slate-300 hover:text-white">View All</button>
      </div>
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-0 py-2 [scrollbar-width:none]">
        {stories.length ? stories.map((story, index) => (
          <button key={story.id} onClick={() => { void handleOpenStory(index); }} className="group relative h-[252px] w-[138px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-[#2f56ff]/80 bg-black text-left shadow-[0_0_0_1px_rgba(182,85,255,0.55),0_0_20px_rgba(76,100,255,0.22)]">
            <img src={story.mediaUrl} alt={story.caption} loading="lazy" decoding="async" className="absolute inset-[1px] h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[22px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/80" />
            <div className="absolute left-2 top-2 flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 p-[1.5px]"><img src={story.mediaUrl} alt="" className="h-full w-full rounded-full object-cover" /></div>
              <div><p className="text-[10px] font-extrabold text-white leading-none">{story.username}</p><p className="mt-1 text-[9px] font-bold text-white/90">{story.timestampLabel ?? '2m'}</p></div>
            </div>
            <div className="absolute bottom-2 left-2 right-2 space-y-1.5">
              <p className="inline-block max-w-full rounded-xl bg-white px-2.5 py-1 text-[10px] font-black leading-tight text-black shadow-sm">{story.badgeText ?? story.caption}</p>
              {story.showViewCount && <p className="flex items-center gap-1 text-[11px] font-semibold text-white/90"><i className="fa-solid fa-eye text-[10px]" aria-hidden="true" /><span>{story.views ?? 0}</span></p>}
            </div>
          </button>
        )) : Array.from({ length: 5 }).map((_, idx) => <div key={idx} className="h-[252px] w-[138px] shrink-0 rounded-[24px] border border-white/10 bg-white/[0.03]" />)}
      </div>
      {!stories.length && (
        <p className="px-1 pb-2 text-xs text-slate-400">{loadError ?? 'Stories will appear here once your first Live Community post is approved.'}</p>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#151c23] p-3 sm:grid-cols-4">
      {trustItems.map(([title, sub]) => <div key={title} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5"><p className="text-[11px] font-black uppercase tracking-wide text-slate-100">{title}</p><p className="mt-1 text-[11px] text-slate-400">{sub}</p></div>)}
    </div>

    {activeIndex !== null && stories[activeIndex] && (
      <div className="fixed inset-0 z-[220] bg-black/95" onClick={() => setActiveIndex(null)}>
        <div className="mx-auto flex h-full w-full max-w-md flex-col px-3 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex gap-1">{stories.map((_, idx) => <div key={idx} className="h-1 flex-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-white" style={{ width: `${idx < activeIndex ? 100 : idx === activeIndex ? progress : 0}%` }} /></div>)}</div>
          <div className="mb-2 flex items-center justify-between text-sm text-white"><span>{stories[activeIndex].username} · {stories[activeIndex].timestampLabel ?? 'Now'}</span><button onClick={() => setActiveIndex(null)}>✕</button></div>
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#111]" onMouseDown={() => { holdRef.current = true; }} onMouseUp={() => { holdRef.current = false; }} onTouchStart={() => { holdRef.current = true; }} onTouchEnd={() => { holdRef.current = false; }}>
            {stories[activeIndex].mediaType === 'video' ? <video src={stories[activeIndex].mediaUrl} className="h-full w-full object-cover" autoPlay muted playsInline /> : <img src={stories[activeIndex].mediaUrl} className="h-full w-full object-cover" alt={stories[activeIndex].caption} />}
          </div>
        </div>
      </div>
    )}
  </section>;
};
