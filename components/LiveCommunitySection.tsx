import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp, collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
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
};

const rarityRing: Record<string, string> = { common: 'from-slate-400/70 to-cyan-500/70', rare: 'from-sky-400/80 to-violet-500/80', epic: 'from-fuchsia-400/80 to-violet-500/80', legendary: 'from-amber-300/90 to-orange-500/90' };

export const LiveCommunitySection: React.FC = () => {
  const [stories, setStories] = useState<LiveCommunityStory[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const holdRef = useRef(false);

  useEffect(() => {
    const now = Timestamp.now();
    const q = query(collection(db, 'liveCommunityStories'), where('approved', '==', true), where('hidden', '!=', true), where('expiresAt', '>', now), orderBy('expiresAt', 'asc'), orderBy('order', 'asc'), limit(30));
    return onSnapshot(q, (snap) => {
      const next = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<LiveCommunityStory, 'id'>) }));
      setStories(next);
    });
  }, []);

  useEffect(() => {
    if (activeIndex === null || holdRef.current) return;
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 2)), 80);
    return () => window.clearInterval(id);
  }, [activeIndex, holdRef.current]);

  useEffect(() => {
    if (progress < 100 || activeIndex === null) return;
    if (activeIndex >= stories.length - 1) setActiveIndex(null);
    else setActiveIndex((v) => (v === null ? 0 : v + 1));
    setProgress(0);
  }, [progress, activeIndex, stories.length]);

  const trustItems = useMemo(() => [
    ['Provably Fair', '100% Transparent'],
    ['Instant Delivery', 'Digital Items'],
    ['Real Shipping', 'Worldwide'],
    ['24/7 Support', "We're here"]
  ], []);

  if (!stories.length) return null;

  return <section className="space-y-4">
    <div className="rounded-2xl border border-white/10 bg-[#171e24] shadow-[0_14px_34px_rgba(5,8,12,0.35)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" /><h2 className="text-sm font-black tracking-[0.16em] text-white">LIVE COMMUNITY</h2></div>
        <button className="text-sm font-semibold text-slate-300 hover:text-white">View All</button>
      </div>
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none]">
        {stories.map((story, index) => (
          <button key={story.id} onClick={() => { setActiveIndex(index); setProgress(0); }} className="group relative h-[218px] w-[122px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/15 bg-[#0f1319] text-left">
            <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b ${rarityRing[story.rarity] ?? rarityRing.rare} opacity-70`} />
            <img src={story.mediaUrl} alt={story.caption} loading="lazy" decoding="async" className="absolute inset-[1px] h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[15px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/75" />
            <div className="absolute left-2 top-2"><p className="text-[11px] font-bold text-white">{story.username}</p><p className="text-[10px] text-slate-200">{story.timestampLabel ?? 'Now'}</p></div>
            <div className="absolute bottom-2 left-2 right-2 space-y-1"><p className="inline-block rounded-xl bg-white px-2 py-1 text-[10px] font-black text-black">{story.badgeText ?? story.caption}</p>{story.showViewCount && <p className="text-[11px] text-white/90">◉ {story.views ?? 0}</p>}</div>
          </button>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#151c23] p-3 sm:grid-cols-4">
      {trustItems.map(([title, sub]) => <div key={title} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5"><p className="text-[11px] font-black uppercase tracking-wide text-slate-100">{title}</p><p className="mt-1 text-[11px] text-slate-400">{sub}</p></div>)}
    </div>

    {activeIndex !== null && stories[activeIndex] && (
      <div className="fixed inset-0 z-[120] bg-black/95" onClick={() => setActiveIndex(null)}>
        <div className="mx-auto flex h-full w-full max-w-md flex-col px-3 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex gap-1">{stories.map((_, idx) => <div key={idx} className="h-1 flex-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-white" style={{ width: `${idx < activeIndex ? 100 : idx === activeIndex ? progress : 0}%` }} /></div>)}</div>
          <div className="mb-2 flex items-center justify-between text-sm text-white"><span>{stories[activeIndex].username} · {stories[activeIndex].timestampLabel ?? 'Now'}</span><button onClick={() => setActiveIndex(null)}>✕</button></div>
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#111]" onMouseDown={() => { holdRef.current = true; }} onMouseUp={() => { holdRef.current = false; }} onTouchStart={() => { holdRef.current = true; }} onTouchEnd={() => { holdRef.current = false; }}>
            {stories[activeIndex].mediaType === 'video' ? <video src={stories[activeIndex].mediaUrl} className="h-full w-full object-cover" autoPlay muted playsInline /> : <img src={stories[activeIndex].mediaUrl} className="h-full w-full object-cover" alt={stories[activeIndex].caption} />}
          </div>
          <div className="mt-2 flex items-center justify-between"><p className="text-sm text-white/90">{stories[activeIndex].caption}</p><div className="flex gap-2"><button disabled={activeIndex===0} onClick={() => {setActiveIndex((v)=>Math.max((v??0)-1,0));setProgress(0);}} className="rounded bg-white/10 px-2 py-1 text-white">‹</button><button disabled={activeIndex===stories.length-1} onClick={() => {setActiveIndex((v)=>Math.min((v??0)+1,stories.length-1));setProgress(0);}} className="rounded bg-white/10 px-2 py-1 text-white">›</button></div></div>
        </div>
      </div>
    )}
  </section>;
};
