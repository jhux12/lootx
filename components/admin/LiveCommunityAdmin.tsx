import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db } from '../../firebase';
import { storage } from '../../firebaseStorage';

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

  const sortedStories = useMemo(() => {
    const statusRank = (story: LiveStory) => (story.status === 'pending' || story.approved === false ? 0 : story.status === 'rejected' ? 2 : 1);
    return [...stories].sort((a, b) => {
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      return Number(b.order ?? 0) - Number(a.order ?? 0);
    });
  }, [stories]);

  const pendingSubmissions = useMemo(
    () => sortedStories.filter((story) => story.source === 'community-submit-pull' && (story.status === 'pending' || story.approved === false)),
    [sortedStories]
  );

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
    <div className="rounded-xl border border-amber-400/20 bg-[#131720] p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold text-white">User Pull Submissions</h4>
          <p className="text-xs text-gray-400">Pending community uploads appear here first for admin approval.</p>
        </div>
        <span className="w-fit rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">{pendingSubmissions.length} pending</span>
      </div>
      {pendingSubmissions.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pendingSubmissions.map((story) => (
            <div key={story.id} className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0b0e14] text-sm text-gray-200">
              <div className="aspect-[4/3] bg-black/30">
                {story.mediaUrl ? <img src={story.mediaUrl} alt={`${story.username || 'User'} pull submission`} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-xs text-gray-500">No preview</div>}
              </div>
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">@{story.username || 'anon'}</span>
                  <span className="rounded bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-100">+{Number(story.rewardCoins ?? 1000).toLocaleString()} coins</span>
                  <span className="rounded bg-slate-700/70 px-2 py-0.5 text-[10px] uppercase">{story.status || 'pending'}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <p>Submitted from: {story.submittedByEmail || story.submittedByUserId || 'account'}</p>
                  <p>Requirements: delivered order, clean/respectful photo, admin approved.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="rounded-lg bg-emerald-600/30 px-3 py-2 text-xs font-bold text-emerald-100" onClick={()=>handleModerationAction('Approve submission', story.id, { approved: true, status: 'approved', hidden: false, approvedAt: serverTimestamp() })}>Approve</button>
                  <button className="rounded-lg bg-red-600/30 px-3 py-2 text-xs font-bold text-red-100" onClick={()=>handleModerationAction('Reject submission', story.id, { approved: false, status: 'rejected', hidden: true, rejectedAt: serverTimestamp() })}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-800 bg-[#0b0e14] p-4 text-sm text-gray-400">No user submissions are waiting for approval.</div>
      )}
    </div>

    <div className="rounded-xl border border-gray-800 bg-[#131720] p-4">
      <h4 className="mb-3 font-semibold text-white">Edit Customer Review Stories</h4>
      <p className="mb-3 text-xs text-gray-400">Add or update custom captions here. Caption edits save when you leave the caption field.</p>
      <div className="space-y-3">
        {sortedStories.map((story) => (
          <div key={`edit-${story.id}`} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-800 bg-[#0b0e14] p-3 text-xs text-gray-200 md:grid-cols-[80px_1fr]">
            {story.mediaUrl ? <img src={story.mediaUrl} alt="" className="h-20 w-20 rounded-lg object-cover" loading="lazy" /> : <div className="grid h-20 w-20 place-items-center rounded-lg bg-black/30 text-gray-500">No image</div>}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="rounded bg-[#050811] p-2 text-white" defaultValue={story.username || ''} placeholder="Username" onBlur={(event)=>handleModerationAction('Update username', story.id, { username: event.target.value.trim() })} />
              <input className="rounded bg-[#050811] p-2 text-white" defaultValue={story.timestampLabel || ''} placeholder="Date / label" onBlur={(event)=>handleModerationAction('Update date label', story.id, { timestampLabel: event.target.value.trim() })} />
              <input className="rounded bg-[#050811] p-2 text-white md:col-span-2" defaultValue={story.mediaUrl || ''} placeholder="Image URL" onBlur={(event)=>handleModerationAction('Update image', story.id, { mediaUrl: event.target.value.trim() })} />
              <label className="md:col-span-2">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Custom caption</span>
                <textarea className="min-h-16 w-full rounded bg-[#050811] p-2 text-white" defaultValue={story.caption || ''} placeholder="Add a custom review caption" onBlur={(event)=>handleModerationAction('Update caption', story.id, { caption: event.target.value.trim() })} />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-xl border border-gray-800 bg-[#131720] p-4"><h4 className="mb-3 font-semibold text-white">Moderation Queue</h4><div className="space-y-2">{sortedStories.map((story) => <div key={story.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-[#0b0e14] p-2 text-xs text-gray-200">{story.mediaUrl && <img src={story.mediaUrl} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />}<span className="font-bold">{story.username || 'anon'}</span><span>{story.caption}</span>{story.source === 'community-submit-pull' && <span className="rounded bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-100">User submission</span>}<span className="rounded bg-white/10 px-2 py-0.5">{story.type}</span><span className="rounded bg-slate-700/70 px-2 py-0.5 text-[10px] uppercase">{story.status || (story.approved ? 'approved' : 'pending')}</span><button className="rounded bg-emerald-600/30 px-2 py-1" onClick={()=>handleModerationAction('Approve', story.id, { approved: true, status: 'approved', hidden: false, approvedAt: serverTimestamp() })}>Approve</button><button className="rounded bg-amber-600/30 px-2 py-1" onClick={()=>handleModerationAction(story.hidden ? 'Unhide' : 'Hide', story.id, { hidden: !story.hidden })}>{story.hidden ? 'Unhide':'Hide'}</button><button className="rounded bg-blue-600/30 px-2 py-1" onClick={()=>handleModerationAction(story.featured ? 'Unfeature' : 'Feature', story.id, { featured: !story.featured })}>{story.featured ? 'Unfeature':'Feature'}</button><button className="rounded bg-red-600/30 px-2 py-1" onClick={async()=>{ try { await deleteDoc(doc(db,'liveCommunityStories',story.id)); showNotice('success','Delete successful.'); } catch (error) { showNotice('error', error instanceof Error ? error.message : 'Unable to delete.'); } }}>Delete</button></div>)}</div></div>
  </div>;
};
