import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';

type CommunityPost = {
  id: string;
  username: string;
  avatarUrl: string;
  imageUrl: string;
  caption: string;
  createdAtMs: number;
  viewCount: number;
};

const timeAgo = (createdAtMs: number) => {
  const diff = Date.now() - createdAtMs;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const LiveCommunitySection: React.FC = () => {
  const { user } = useGame();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [uploadImageUrl, setUploadImageUrl] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const postsQuery = query(
      collection(db, 'communityPosts'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    return onSnapshot(postsQuery, (snapshot) => {
      const next = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          username: String(data.username ?? 'community.member'),
          avatarUrl: String(data.avatarUrl ?? ''),
          imageUrl: String(data.imageUrl ?? ''),
          caption: String(data.caption ?? ''),
          viewCount: Number(data.viewCount ?? 0),
          createdAtMs: Number(data.createdAt?.toMillis?.() ?? Date.now())
        };
      }).filter((entry) => entry.imageUrl);
      setPosts(next);
    });
  }, []);

  const visiblePosts = useMemo(() => (showAll ? posts : posts.slice(0, 6)), [posts, showAll]);

  const submitPost = async () => {
    if (!user || !uploadImageUrl.trim()) return;
    setUploading(true);
    try {
      await addDoc(collection(db, 'communityPosts'), {
        username: user.username || user.name || 'community.member',
        avatarUrl: user.photoURL || user.avatar || '',
        imageUrl: uploadImageUrl.trim(),
        caption: uploadCaption.trim(),
        status: 'pending',
        viewCount: 0,
        source: 'user',
        userId: user.id,
        createdAt: serverTimestamp()
      });
      setUploadImageUrl('');
      setUploadCaption('');
      alert('Submitted! Admin review is required before this appears publicly.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#11161f] p-3 sm:p-4" aria-label="Live community">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-100"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Live Community</h2>
        <button type="button" onClick={() => setShowAll((prev) => !prev)} className="text-xs font-semibold text-slate-300 hover:text-white">{showAll ? 'Show less' : 'View All'}</button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {visiblePosts.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-2xl border border-violet-400/40 bg-[#070b12]">
            <div className="flex items-center gap-2 p-2">
              <img src={post.avatarUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=member'} alt={post.username} className="h-7 w-7 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{post.username}</p>
                <p className="text-[11px] text-slate-400">{timeAgo(post.createdAtMs)}</p>
              </div>
            </div>
            <img src={post.imageUrl} alt={post.caption || `${post.username} post`} className="h-36 w-full object-cover sm:h-44" loading="lazy" />
            <div className="p-2">
              <p className="line-clamp-2 text-xs text-slate-100">{post.caption || 'Community post'}</p>
              <p className="mt-1 text-[11px] text-slate-400">👁 {post.viewCount}</p>
            </div>
          </article>
        ))}
      </div>

      {user && (
        <div className="mt-4 rounded-xl border border-white/10 bg-[#0f141c] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Post to community (requires admin approval)</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input value={uploadImageUrl} onChange={(event) => setUploadImageUrl(event.target.value)} placeholder="Image URL" className="rounded-lg border border-white/15 bg-[#0a0f16] px-3 py-2 text-sm text-white" />
            <input value={uploadCaption} onChange={(event) => setUploadCaption(event.target.value)} placeholder="Caption" className="rounded-lg border border-white/15 bg-[#0a0f16] px-3 py-2 text-sm text-white" />
          </div>
          <button type="button" onClick={submitPost} disabled={uploading || !uploadImageUrl.trim()} className="mt-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{uploading ? 'Submitting...' : 'Submit post'}</button>
        </div>
      )}
    </section>
  );
};
