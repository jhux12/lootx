import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../firebase';

type StoryStatus = 'pending' | 'approved' | 'rejected';
type LiveStory = Record<string, any> & { id: string };

const categories = ['shipment', 'delivered', 'big hit', 'upgrader', 'battles', 'psa/slabs', 'inventory flex', 'community setups', 'free box wins'];

const EMPTY_DRAFT = {
  username: '',
  caption: '',
  badgeText: '',
  type: 'shipment',
  rarity: 'rare',
  showViewCount: true,
  featured: false,
  approved: true,
  mediaUrl: '',
  linkUrl: ''
};

export const LiveCommunityAdmin: React.FC = () => {
  const [stories, setStories] = useState<LiveStory[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'liveCommunityStories'), orderBy('order', 'asc'));
    return onSnapshot(q, (snap) => setStories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveStory))));
  }, []);

  const analytics = useMemo(
    () =>
      stories.reduce(
        (acc, s) => ({
          impressions: acc.impressions + (s.views || 0),
          taps: acc.taps + (s.clicks || 0),
          completion: acc.completion + (s.completionRate || 0),
          swipe: acc.swipe + (s.swipeThroughRate || 0),
          ctr: acc.ctr + (s.clickThroughs || 0)
        }),
        { impressions: 0, taps: 0, completion: 0, swipe: 0, ctr: 0 }
      ),
    [stories]
  );

  const showNotice = (tone: 'success' | 'error', message: string) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 3200);
  };

  const handleCreate = async () => {
    if (isSaving) return;
    if (!draft.username.trim()) return showNotice('error', 'Username is required.');
    if (!file && !draft.mediaUrl.trim()) return showNotice('error', 'Add an image/video file or media URL.');

    setIsSaving(true);
    try {
      let mediaUrl = draft.mediaUrl.trim();
      let mediaType: 'image' | 'video' = 'image';
      if (file) {
        const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
        const path = `live-community/${Date.now()}-${safeName}`;
        const uploadRef = ref(storage, path);
        await uploadBytes(uploadRef, file);
        mediaUrl = await getDownloadURL(uploadRef);
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
      } else if (/\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(mediaUrl)) {
        mediaType = 'video';
      }

      const publishAtMillis = draft.publishAt ? new Date(draft.publishAt).getTime() : Date.now();
      const expiresAtMillis = draft.expiresAt ? new Date(draft.expiresAt).getTime() : Date.now() + 24 * 60 * 60 * 1000;

      await addDoc(collection(db, 'liveCommunityStories'), {
        username: draft.username.trim(),
        caption: draft.caption.trim(),
        badgeText: draft.badgeText.trim() || draft.caption.trim() || null,
        type: draft.type,
        rarity: draft.rarity,
        showViewCount: Boolean(draft.showViewCount),
        featured: Boolean(draft.featured),
        approved: Boolean(draft.approved),
        status: (draft.approved ? 'approved' : 'pending') as StoryStatus,
        mediaUrl,
        mediaType,
        linkUrl: draft.linkUrl.trim() || null,
        createdAt: serverTimestamp(),
        publishAt: Timestamp.fromMillis(publishAtMillis),
        expiresAt: Timestamp.fromMillis(expiresAtMillis),
        order: stories.length + 1,
        views: 0,
        clicks: 0,
        hidden: false
      });

      setDraft(EMPTY_DRAFT);
      setFile(null);
      showNotice('success', 'Story published successfully.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to publish story.');
    } finally {
      setIsSaving(false);
    }
  };



  const handleModerationAction = async (action: string, storyId: string, patch: Record<string, unknown>) => {
    try {
      await updateDoc(doc(db, 'liveCommunityStories', storyId), patch);
      showNotice('success', `${action} successful.`);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : `Unable to ${action.toLowerCase()}.`);
    }
  };

  return <div className="space-y-6">
    {notice && <div className={`rounded-lg border px-3 py-2 text-sm ${notice.tone === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}>{notice.message}</div>}
    <div className="rounded-xl border border-gray-800 bg-[#131720] p-5"><h3 className="text-lg font-bold text-white">Live Community Stories</h3><p className="text-sm text-gray-400">Manage stories, scheduling, moderation, analytics, and community submissions.</p></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-800 bg-[#131720] p-4 space-y-3">
        <h4 className="font-semibold text-white">Add Story</h4>
        <input className="w-full rounded bg-[#0b0e14] p-2 text-white" placeholder="Username" value={draft.username} onChange={(e)=>setDraft({...draft, username:e.target.value})} />
        <input className="w-full rounded bg-[#0b0e14] p-2 text-white" placeholder="Caption (optional)" value={draft.caption} onChange={(e)=>setDraft({...draft, caption:e.target.value})} />
        <input className="w-full rounded bg-[#0b0e14] p-2 text-white" placeholder="Badge text (optional)" value={draft.badgeText} onChange={(e)=>setDraft({...draft, badgeText:e.target.value})} />
        <input className="w-full rounded bg-[#0b0e14] p-2 text-white" placeholder="Media URL (optional if uploading file)" value={draft.mediaUrl} onChange={(e)=>setDraft({...draft, mediaUrl:e.target.value})} />
        <select className="w-full rounded bg-[#0b0e14] p-2 text-white" value={draft.type} onChange={(e)=>setDraft({...draft, type:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select>
        <input type="file" accept="image/*,video/*" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} className="w-full text-xs text-gray-300"/>
        <div className="grid grid-cols-2 gap-2"><input type="datetime-local" className="rounded bg-[#0b0e14] p-2 text-white" onChange={(e)=>setDraft({...draft, publishAt:e.target.value})}/><input type="datetime-local" className="rounded bg-[#0b0e14] p-2 text-white" onChange={(e)=>setDraft({...draft, expiresAt:e.target.value})}/></div>
        <button onClick={handleCreate} disabled={isSaving} className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? 'Publishing...' : 'Publish story'}</button>
      </div>
      <div className="rounded-xl border border-gray-800 bg-[#131720] p-4 text-sm text-gray-300">
        <h4 className="mb-2 font-semibold text-white">Analytics Snapshot</h4>
        <p>Impressions: {analytics.impressions}</p><p>Taps: {analytics.taps}</p><p>Completion rate total: {analytics.completion}</p><p>Swipe-through total: {analytics.swipe}</p><p>Click-throughs: {analytics.ctr}</p>
      </div>
    </div>
    <div className="rounded-xl border border-gray-800 bg-[#131720] p-4"><h4 className="mb-3 font-semibold text-white">Moderation Queue</h4><div className="space-y-2">{stories.map((story) => <div key={story.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-[#0b0e14] p-2 text-xs text-gray-200"><span className="font-bold">{story.username || 'anon'}</span><span>{story.caption}</span><span className="rounded bg-white/10 px-2 py-0.5">{story.type}</span><span className="rounded bg-slate-700/70 px-2 py-0.5 text-[10px] uppercase">{story.status || (story.approved ? 'approved' : 'pending')}</span><button className="rounded bg-emerald-600/30 px-2 py-1" onClick={()=>handleModerationAction('Approve', story.id, { approved: true, status: 'approved', hidden: false, approvedAt: serverTimestamp() })}>Approve</button><button className="rounded bg-amber-600/30 px-2 py-1" onClick={()=>handleModerationAction(story.hidden ? 'Unhide' : 'Hide', story.id, { hidden: !story.hidden })}>{story.hidden ? 'Unhide':'Hide'}</button><button className="rounded bg-blue-600/30 px-2 py-1" onClick={()=>handleModerationAction(story.featured ? 'Unfeature' : 'Feature', story.id, { featured: !story.featured })}>{story.featured ? 'Unfeature':'Feature'}</button><button className="rounded bg-red-600/30 px-2 py-1" onClick={async()=>{ try { await deleteDoc(doc(db,'liveCommunityStories',story.id)); showNotice('success','Delete successful.'); } catch (error) { showNotice('error', error instanceof Error ? error.message : 'Unable to delete.'); } }}>Delete</button></div>)}</div></div>
  </div>;
};
