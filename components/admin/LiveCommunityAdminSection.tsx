import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

type PostStatus = 'pending' | 'approved' | 'rejected';

type CommunityPost = {
  id: string;
  username: string;
  avatarUrl: string;
  imageUrl: string;
  caption: string;
  status: PostStatus;
  source: 'admin' | 'user';
};

export const LiveCommunityAdminSection: React.FC = () => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [form, setForm] = useState({ username: '', avatarUrl: '', imageUrl: '', caption: '' });

  useEffect(() => {
    const postsQuery = query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'), limit(60));
    return onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          username: String(data.username ?? ''),
          avatarUrl: String(data.avatarUrl ?? ''),
          imageUrl: String(data.imageUrl ?? ''),
          caption: String(data.caption ?? ''),
          status: (data.status === 'approved' || data.status === 'rejected' ? data.status : 'pending') as PostStatus,
          source: data.source === 'admin' ? 'admin' : 'user'
        };
      }));
    });
  }, []);

  const createAdminPost = async () => {
    if (!form.imageUrl.trim() || !form.username.trim()) return;
    await addDoc(collection(db, 'communityPosts'), {
      ...form,
      status: 'approved',
      source: 'admin',
      viewCount: 0,
      createdAt: serverTimestamp()
    });
    setForm({ username: '', avatarUrl: '', imageUrl: '', caption: '' });
  };

  const setStatus = async (id: string, status: PostStatus) => {
    await updateDoc(doc(db, 'communityPosts', id), { status, reviewedAt: serverTimestamp() });
  };

  const pending = posts.filter((post) => post.status === 'pending');

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-[#10151f] p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-white">Live Community Admin</h3>
        <p className="mt-1 text-xs text-gray-400">Create homepage community cards with customer usernames/profile images and moderate user submissions.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} placeholder="Username" className="rounded-lg border border-gray-700 bg-[#0a0f16] px-3 py-2 text-sm text-white" />
          <input value={form.avatarUrl} onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))} placeholder="Profile image URL" className="rounded-lg border border-gray-700 bg-[#0a0f16] px-3 py-2 text-sm text-white" />
          <input value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="Post image URL" className="rounded-lg border border-gray-700 bg-[#0a0f16] px-3 py-2 text-sm text-white md:col-span-2" />
          <input value={form.caption} onChange={(event) => setForm((prev) => ({ ...prev, caption: event.target.value }))} placeholder="Caption" className="rounded-lg border border-gray-700 bg-[#0a0f16] px-3 py-2 text-sm text-white md:col-span-2" />
        </div>
        <button type="button" onClick={createAdminPost} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Publish Admin Post</button>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#10151f] p-4">
        <h4 className="text-sm font-bold text-white">Pending user submissions ({pending.length})</h4>
        <div className="mt-3 space-y-2">
          {pending.length === 0 ? <p className="text-xs text-gray-400">No pending posts.</p> : pending.map((post) => (
            <div key={post.id} className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-[#0b1018] p-2 sm:flex-row sm:items-center">
              <img src={post.imageUrl} alt={post.caption || post.username} className="h-20 w-20 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{post.username}</p>
                <p className="truncate text-xs text-gray-300">{post.caption || 'No caption'}</p>
                <p className="text-[11px] uppercase text-gray-500">Source: {post.source}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStatus(post.id, 'approved')} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold">Approve</button>
                <button type="button" onClick={() => setStatus(post.id, 'rejected')} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-bold">Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
