import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../firebase';

type StoryStatus = 'pending' | 'approved' | 'rejected';
const categories = ['shipment','delivered','big hit','upgrader','battles','psa/slabs','inventory flex','community setups','free box wins'];

export const LiveCommunityAdmin: React.FC = () => {
  const [stories, setStories] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ username:'', caption:'', rarity:'rare', badgeText:'', type:'shipment', showViewCount:true, featured:false, approved:true });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'liveCommunityStories'), orderBy('order', 'asc'));
    return onSnapshot(q, (snap) => setStories(snap.docs.map((d)=>({id:d.id, ...d.data()}))));
  }, []);

  const analytics = useMemo(() => stories.reduce((acc, s) => ({ impressions: acc.impressions + (s.views || 0), taps: acc.taps + (s.clicks || 0), completion: acc.completion + (s.completionRate || 0), swipe: acc.swipe + (s.swipeThroughRate || 0), ctr: acc.ctr + (s.clickThroughs || 0) }), { impressions:0,taps:0,completion:0,swipe:0,ctr:0 }), [stories]);

  const handleCreate = async () => {
    let mediaUrl = draft.mediaUrl || '';
    let mediaType = draft.mediaType || 'image';
    if (file) {
      const path = `live-community/${Date.now()}-${file.name}`;
      const uploadRef = ref(storage, path);
      await uploadBytes(uploadRef, file);
      mediaUrl = await getDownloadURL(uploadRef);
      mediaType = file.type.startsWith('video') ? 'video' : 'image';
    }
    await addDoc(collection(db, 'liveCommunityStories'), {
      ...draft,
      mediaUrl,
      mediaType,
      createdAt: serverTimestamp(),
      expiresAt: draft.expiresAt ? Timestamp.fromDate(new Date(draft.expiresAt)) : Timestamp.fromMillis(Date.now()+86400000),
      publishAt: draft.publishAt ? Timestamp.fromDate(new Date(draft.publishAt)) : serverTimestamp(),
      status: (draft.status || 'approved') as StoryStatus,
      order: stories.length + 1,
      views: 0,
      clicks: 0,
      approved: draft.approved ?? true,
      hidden: false
    });
    setDraft({ username:'', caption:'', rarity:'rare', badgeText:'', type:'shipment', showViewCount:true, featured:false, approved:true });
    setFile(null);
  };

  return <div className="space-y-6">
    <div className="rounded-xl border border-gray-800 bg-[#131720] p-5"><h3 className="text-lg font-bold text-white">Live Community Stories</h3><p className="text-sm text-gray-400">Manage stories, scheduling, moderation, analytics, and community submissions.</p></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-800 bg-[#131720] p-4 space-y-3">
        <h4 className="font-semibold text-white">Add Story</h4>
        <input className="w-full rounded bg-[#0b0e14] p-2 text-white" placeholder="Username" value={draft.username} onChange={(e)=>setDraft({...draft, username:e.target.value})} />
        <input className="w-full rounded bg-[#0b0e14] p-2 text-white" placeholder="Caption" value={draft.caption} onChange={(e)=>setDraft({...draft, caption:e.target.value})} />
        <select className="w-full rounded bg-[#0b0e14] p-2 text-white" value={draft.type} onChange={(e)=>setDraft({...draft, type:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select>
        <input type="file" accept="image/*,video/*" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} className="w-full text-xs text-gray-300"/>
        <div className="grid grid-cols-2 gap-2"><input type="datetime-local" className="rounded bg-[#0b0e14] p-2 text-white" onChange={(e)=>setDraft({...draft, publishAt:e.target.value})}/><input type="datetime-local" className="rounded bg-[#0b0e14] p-2 text-white" onChange={(e)=>setDraft({...draft, expiresAt:e.target.value})}/></div>
        <button onClick={handleCreate} className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">Publish story</button>
      </div>
      <div className="rounded-xl border border-gray-800 bg-[#131720] p-4 text-sm text-gray-300">
        <h4 className="mb-2 font-semibold text-white">Analytics Snapshot</h4>
        <p>Impressions: {analytics.impressions}</p><p>Taps: {analytics.taps}</p><p>Completion rate total: {analytics.completion}</p><p>Swipe-through total: {analytics.swipe}</p><p>Click-throughs: {analytics.ctr}</p>
      </div>
    </div>
    <div className="rounded-xl border border-gray-800 bg-[#131720] p-4">
      <h4 className="mb-3 font-semibold text-white">Moderation Queue</h4>
      <div className="space-y-2">
        {stories.map((story) => <div key={story.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-[#0b0e14] p-2 text-xs text-gray-200"><span className="font-bold">{story.username || 'anon'}</span><span>{story.caption}</span><span className="rounded bg-white/10 px-2 py-0.5">{story.type}</span><button className="rounded bg-emerald-600/30 px-2 py-1" onClick={()=>updateDoc(doc(db,'liveCommunityStories',story.id), {approved:true,status:'approved',hidden:false})}>Approve</button><button className="rounded bg-amber-600/30 px-2 py-1" onClick={()=>updateDoc(doc(db,'liveCommunityStories',story.id), {hidden:!story.hidden})}>{story.hidden ? 'Unhide':'Hide'}</button><button className="rounded bg-blue-600/30 px-2 py-1" onClick={()=>updateDoc(doc(db,'liveCommunityStories',story.id), {featured:!story.featured})}>{story.featured ? 'Unfeature':'Feature'}</button><button className="rounded bg-red-600/30 px-2 py-1" onClick={()=>deleteDoc(doc(db,'liveCommunityStories',story.id))}>Delete</button></div>)}
      </div>
    </div>
  </div>;
};
