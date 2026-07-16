import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { ImageUrlField } from './ImageUrlField';
import { HomepageImagePlaceholder } from './HomepageImagePlaceholder';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  GalleryCategory,
  HomepageCommunityItem,
  HomepageGalleryItem,
  HomepageSettings,
  HomepageTrustCard,
  HOMEPAGE_CONTENT_DOC_PATH,
  loadHomepageSettings,
  makeHomepageContentId,
  saveHomepageSettings
} from '../../utils/homepageContent';

const tabs = ['Hero', 'Trust', 'Featured Box Overrides', 'Wins and Deliveries', 'Community Highlights', 'Activity', 'Social Links', 'Homepage Visibility'] as const;
type Tab = typeof tabs[number];

type Toast = { tone: 'success' | 'error'; message: string } | null;

const cloneSettings = (settings: HomepageSettings): HomepageSettings => JSON.parse(JSON.stringify(settings));

const FieldLabel = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">{children}</span>;

export const HomepageContentEditor: React.FC = () => {
  const { user, boxes } = useGame();
  const [activeTab, setActiveTab] = useState<Tab>('Hero');
  const [saved, setSaved] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);
  const [draft, setDraft] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'gallery' | 'community'; id: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHomepageSettings(0)
      .then((settings) => {
        if (cancelled) return;
        setSaved(cloneSettings(settings));
        setDraft(cloneSettings(settings));
      })
      .catch(() => setToast({ tone: 'error', message: 'Unable to load homepage content settings.' }))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isDirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const saveState = isSaving ? 'saving' : isDirty ? 'dirty' : 'saved';

  const showToast = (tone: 'success' | 'error', message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const updateDraft = (updater: (current: HomepageSettings) => HomepageSettings) => setDraft((current) => updater(cloneSettings(current)));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveHomepageSettings(draft, user?.id);
      setSaved(cloneSettings(draft));
      showToast('success', 'Homepage content saved.');
    } catch (error) {
      showToast('error', 'Unable to save homepage content. Check admin permissions and image URLs.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => setDraft(cloneSettings(saved));

  const addTrustCard = () => updateDraft((current) => ({
    ...current,
    trust: { ...current.trust, cards: [...current.trust.cards, { id: makeHomepageContentId(), heading: 'New Trust Card', value: '', label: 'Trust statement', description: '', iconName: 'shield', iconUrl: '', enabled: true, sortOrder: current.trust.cards.length + 1 }].slice(0, 4) }
  }));

  const patchTrustCard = (id: string, patch: Partial<HomepageTrustCard>) => updateDraft((current) => ({ ...current, trust: { ...current.trust, cards: current.trust.cards.map((card) => card.id === id ? { ...card, ...patch } : card) } }));

  const addGalleryItem = () => updateDraft((current) => ({ ...current, gallery: { ...current.gallery, items: [...current.gallery.items, { id: makeHomepageContentId(), imageUrl: '', imageAlt: '', imageFit: 'contain', category: 'Recently Pulled', itemName: '', caption: '', optionalDate: '', optionalStatus: '', optionalLink: '', published: false, sortOrder: current.gallery.items.length + 1 }] } }));
  const patchGalleryItem = (id: string, patch: Partial<HomepageGalleryItem>) => updateDraft((current) => ({ ...current, gallery: { ...current.gallery, items: current.gallery.items.map((item) => item.id === id ? { ...item, ...patch } : item) } }));

  const addCommunityItem = () => updateDraft((current) => ({ ...current, community: { ...current.community, items: [...current.community.items, { id: makeHomepageContentId(), imageUrl: '', imageAlt: '', displayName: 'Pullz Collector', caption: '', sourceType: 'Community photo', socialUrl: '', approved: false, published: false, sortOrder: current.community.items.length + 1, createdDate: '' }] } }));
  const patchCommunityItem = (id: string, patch: Partial<HomepageCommunityItem>) => updateDraft((current) => ({ ...current, community: { ...current.community, items: current.community.items.map((item) => item.id === id ? { ...item, ...patch } : item) } }));

  const removeItem = () => {
    if (!deleteTarget) return;
    updateDraft((current) => deleteTarget.type === 'gallery'
      ? { ...current, gallery: { ...current.gallery, items: current.gallery.items.filter((item) => item.id !== deleteTarget.id) } }
      : { ...current, community: { ...current.community, items: current.community.items.filter((item) => item.id !== deleteTarget.id) } });
    setDeleteTarget(null);
  };

  if (isLoading) {
    return <div className="rounded-xl border border-gray-800 bg-[#131720] p-6 text-sm text-gray-300">Loading Homepage Content settings…</div>;
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-[#131720] p-4 sm:p-6">
      {toast ? <div className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm font-semibold ${toast.tone === 'success' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-red-500/40 bg-red-500/15 text-red-200'}`}>{toast.message}</div> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-black text-white">Homepage Content</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">Manage homepage hero images, proof cards, gallery, community highlights, activity, and social links. Stored in <code className="rounded bg-black/30 px-1 py-0.5 text-purple-200">{HOMEPAGE_CONTENT_DOC_PATH}</code>.</p>
          {isDirty ? <p className="mt-2 text-xs font-semibold text-amber-300">You have unsaved homepage content changes.</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={handleCancel} disabled={!isDirty || isSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 text-sm font-bold text-gray-200 hover:bg-gray-800 disabled:opacity-50"><X className="h-4 w-4" /> Cancel</button>
          <button type="button" onClick={() => { void handleSave(); }} disabled={!isDirty || isSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-purple-400/40 bg-purple-500/15 px-4 text-sm font-bold text-purple-100 hover:bg-purple-500/25 disabled:opacity-50"><Save className="h-4 w-4" /> {isSaving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Homepage content sections">
        {tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${activeTab === tab ? 'bg-purple-500 text-white' : 'bg-[#0b0e14] text-gray-300 hover:bg-gray-800'}`}>{tab}</button>)}
      </div>

      <div className="mt-5 space-y-5">
        {activeTab === 'Hero' ? <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><FieldLabel>Eyebrow</FieldLabel><Input value={draft.hero.eyebrow} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, eyebrow: e.target.value } }))} className="w-full bg-[#0b0e14] border-gray-700 text-white" /></label>
            <label><FieldLabel>Highlighted headline text</FieldLabel><Input value={draft.hero.highlightedText} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, highlightedText: e.target.value } }))} className="w-full bg-[#0b0e14] border-gray-700 text-white" /></label>
          </div>
          <label><FieldLabel>Hero body</FieldLabel><Textarea rows={3} value={draft.hero.body} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, body: e.target.value } }))} className="w-full bg-[#0b0e14] border-gray-700 text-white" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label><FieldLabel>Primary CTA label</FieldLabel><Input value={draft.hero.primaryCtaLabel} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, primaryCtaLabel: e.target.value } }))} className="w-full bg-[#0b0e14] border-gray-700 text-white" /></label><label><FieldLabel>Secondary CTA label</FieldLabel><Input value={draft.hero.secondaryCtaLabel} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, secondaryCtaLabel: e.target.value } }))} className="w-full bg-[#0b0e14] border-gray-700 text-white" /></label></div>
          <ImageUrlField label="Main Hero Product Image" value={draft.hero.mainImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, mainImageUrl: v } }))} altValue={draft.hero.mainImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, mainImageAlt: v } }))} recommendedDimensions="1200 × 1200 px" acceptedFormats="Transparent PNG or WebP" aspectRatio="1:1" usage="Used for the main Pullz.gg product visual" saveState={saveState} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ImageUrlField label="Left Floating Collectible" value={draft.hero.leftFloatingImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, leftFloatingImageUrl: v } }))} altValue={draft.hero.leftFloatingImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, leftFloatingImageAlt: v } }))} recommendedDimensions="700 × 1000 px" acceptedFormats="Portrait PNG or WebP" aspectRatio="4:5" usage="Left layered collectible beside the hero product" saveState={saveState} />
            <ImageUrlField label="Right Floating Collectible" value={draft.hero.rightFloatingImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, rightFloatingImageUrl: v } }))} altValue={draft.hero.rightFloatingImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, rightFloatingImageAlt: v } }))} recommendedDimensions="700 × 1000 px" acceptedFormats="Portrait PNG or WebP" aspectRatio="4:5" usage="Right layered collectible beside the hero product" saveState={saveState} />
          </div>
          <ImageUrlField label="Hero Background Texture" value={draft.hero.backgroundImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, backgroundImageUrl: v } }))} altValue={draft.hero.backgroundImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, backgroundImageAlt: v } }))} recommendedDimensions="1920 × 1080 px" acceptedFormats="JPG, PNG, or WebP" aspectRatio="16:9" usage="Optional subtle texture behind the hero" saveState={saveState} />
          <div className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.hero.featuredWinnerEnabled} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, featuredWinnerEnabled: e.target.checked } }))} className="h-4 w-4" /> Enable hero proof card</label><div className="mt-3 grid gap-3 sm:grid-cols-3"><Input value={draft.hero.featuredWinnerLabel} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, featuredWinnerLabel: e.target.value } }))} placeholder="Recently Won" className="bg-[#111827] border-gray-700 text-white" /><Input value={draft.hero.featuredWinnerItemName} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, featuredWinnerItemName: e.target.value } }))} placeholder="Item name" className="bg-[#111827] border-gray-700 text-white" /><Input value={draft.hero.featuredWinnerTimestamp} onChange={(e) => updateDraft((c) => ({ ...c, hero: { ...c.hero, featuredWinnerTimestamp: e.target.value } }))} placeholder="Optional timestamp" className="bg-[#111827] border-gray-700 text-white" /></div></div>
          <ImageUrlField label="Featured Winner Image" value={draft.hero.featuredWinnerImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, featuredWinnerImageUrl: v } }))} altValue={draft.hero.featuredWinnerImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, hero: { ...c.hero, featuredWinnerImageAlt: v } }))} recommendedDimensions="800 × 1100 px" acceptedFormats="Portrait PNG or WebP" aspectRatio="4:5" usage="Optional image inside the recently won proof card" saveState={saveState} />
        </div> : null}

        {activeTab === 'Trust' ? <div className="space-y-4"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.trust.useNumericMetrics} onChange={(e) => updateDraft((c) => ({ ...c, trust: { ...c.trust, useNumericMetrics: e.target.checked } }))} className="h-4 w-4" /> Use numeric trust metrics</label><p className="text-xs text-gray-400">Only enter verified or manually approved metrics. Leave values blank for qualitative cards.</p><div className="grid gap-3 md:grid-cols-2">{[...draft.trust.cards].sort((a, b) => a.sortOrder - b.sortOrder).map((card) => <div key={card.id} className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4"><label className="mb-3 flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={card.enabled} onChange={(e) => patchTrustCard(card.id, { enabled: e.target.checked })} className="h-4 w-4" /> Enabled</label><div className="grid gap-2"><Input value={card.heading} onChange={(e) => patchTrustCard(card.id, { heading: e.target.value })} placeholder="Heading" className="bg-[#111827] border-gray-700 text-white" /><Input value={card.value} onChange={(e) => patchTrustCard(card.id, { value: e.target.value })} placeholder="Optional verified value" className="bg-[#111827] border-gray-700 text-white" /><Input value={card.label} onChange={(e) => patchTrustCard(card.id, { label: e.target.value })} placeholder="Label" className="bg-[#111827] border-gray-700 text-white" /><Textarea rows={2} value={card.description} onChange={(e) => patchTrustCard(card.id, { description: e.target.value })} placeholder="Short description" className="bg-[#111827] border-gray-700 text-white" /><Input type="number" value={card.sortOrder} onChange={(e) => patchTrustCard(card.id, { sortOrder: Number(e.target.value) })} placeholder="Sort order" className="bg-[#111827] border-gray-700 text-white" /><ImageUrlField label={`${card.heading || 'Trust'} Icon`} value={card.iconUrl} onChange={(v) => patchTrustCard(card.id, { iconUrl: v })} recommendedDimensions="128 × 128 px" acceptedFormats="Transparent SVG, PNG, or WebP" aspectRatio="1:1" usage="Optional trust icon override" saveState={saveState} /></div></div>)}</div><button type="button" disabled={draft.trust.cards.length >= 4} onClick={addTrustCard} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-purple-400/30 px-4 text-sm font-bold text-purple-100 disabled:opacity-50"><Plus className="h-4 w-4" /> Add trust card</button></div> : null}

        {activeTab === 'Featured Box Overrides' ? <div className="space-y-4"><p className="text-sm text-gray-400">Overrides are keyed to existing box IDs. If left blank, the homepage uses the top existing box item and then the box cover image.</p>{boxes.slice().sort((a,b)=>a.name.localeCompare(b.name)).map((box) => { const override = draft.featuredBoxOverrides[box.id] ?? { chaseImageUrl: '', chaseImageAlt: '', secondaryChaseImageUrl: '', secondaryChaseImageAlt: '', chaseLabel: '', enabled: false }; return <details key={box.id} className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4"><summary className="cursor-pointer text-sm font-bold text-white">{box.name}</summary><div className="mt-4 space-y-3"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={override.enabled} onChange={(e) => updateDraft((c) => ({ ...c, featuredBoxOverrides: { ...c.featuredBoxOverrides, [box.id]: { ...override, enabled: e.target.checked } } }))} className="h-4 w-4" /> Enable override</label><Input value={override.chaseLabel} onChange={(e) => updateDraft((c) => ({ ...c, featuredBoxOverrides: { ...c.featuredBoxOverrides, [box.id]: { ...override, chaseLabel: e.target.value } } }))} placeholder="Top chase label" className="bg-[#111827] border-gray-700 text-white" /><ImageUrlField label={`${box.name} Chase Image`} value={override.chaseImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, featuredBoxOverrides: { ...c.featuredBoxOverrides, [box.id]: { ...override, chaseImageUrl: v } } }))} altValue={override.chaseImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, featuredBoxOverrides: { ...c.featuredBoxOverrides, [box.id]: { ...override, chaseImageAlt: v } } }))} recommendedDimensions="600 × 840 px or 700 × 1000 px" acceptedFormats="PNG or WebP" aspectRatio="4:5" usage="Primary visual chase item for this box" saveState={saveState} /><ImageUrlField label={`${box.name} Secondary Chase Image`} value={override.secondaryChaseImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, featuredBoxOverrides: { ...c.featuredBoxOverrides, [box.id]: { ...override, secondaryChaseImageUrl: v } } }))} altValue={override.secondaryChaseImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, featuredBoxOverrides: { ...c.featuredBoxOverrides, [box.id]: { ...override, secondaryChaseImageAlt: v } } }))} recommendedDimensions="1200 × 900 px composition" acceptedFormats="PNG or WebP" aspectRatio="3:2" usage="Optional second chase item" saveState={saveState} /></div></details>; })}</div> : null}

        {activeTab === 'Wins and Deliveries' ? <div className="space-y-4"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.gallery.enabled} onChange={(e) => updateDraft((c) => ({ ...c, gallery: { ...c.gallery, enabled: e.target.checked } }))} /> Enable gallery</label><button type="button" onClick={addGalleryItem} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-purple-400/30 px-4 text-sm font-bold text-purple-100"><Plus className="h-4 w-4" /> Add gallery item</button>{[...draft.gallery.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => <div key={item.id} className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={item.published} onChange={(e) => patchGalleryItem(item.id, { published: e.target.checked })} /> Published</label><button type="button" onClick={() => setDeleteTarget({ type: 'gallery', id: item.id })} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-500/25 px-3 text-xs font-bold text-red-200"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Select value={item.category} onChange={(e) => patchGalleryItem(item.id, { category: e.target.value as GalleryCategory })} className="bg-[#111827] border-gray-700 text-white"><option>Recently Pulled</option><option>Recently Shipped</option><option>Community Win</option><option>Delivered</option><option>Customer Photo</option></Select><Input value={item.itemName} onChange={(e) => patchGalleryItem(item.id, { itemName: e.target.value })} placeholder="Item name" className="bg-[#111827] border-gray-700 text-white" /><Input type="number" value={item.sortOrder} onChange={(e) => patchGalleryItem(item.id, { sortOrder: Number(e.target.value) })} placeholder="Sort" className="bg-[#111827] border-gray-700 text-white" /><Select value={item.imageFit} onChange={(e) => patchGalleryItem(item.id, { imageFit: e.target.value as 'contain' | 'cover' })} className="bg-[#111827] border-gray-700 text-white"><option value="contain">Contain</option><option value="cover">Cover</option></Select></div><Textarea rows={2} value={item.caption} onChange={(e) => patchGalleryItem(item.id, { caption: e.target.value })} placeholder="Optional caption" className="mt-3 bg-[#111827] border-gray-700 text-white" /><div className="mt-3 grid gap-3 sm:grid-cols-3"><Input value={item.optionalDate} onChange={(e) => patchGalleryItem(item.id, { optionalDate: e.target.value })} placeholder="Optional date" className="bg-[#111827] border-gray-700 text-white" /><Input value={item.optionalStatus} onChange={(e) => patchGalleryItem(item.id, { optionalStatus: e.target.value })} placeholder="Optional status" className="bg-[#111827] border-gray-700 text-white" /><Input value={item.optionalLink} onChange={(e) => patchGalleryItem(item.id, { optionalLink: e.target.value })} placeholder="Optional link" className="bg-[#111827] border-gray-700 text-white" /></div><div className="mt-3"><ImageUrlField label="Gallery Image" value={item.imageUrl} onChange={(v) => patchGalleryItem(item.id, { imageUrl: v })} altValue={item.imageAlt} onAltChange={(v) => patchGalleryItem(item.id, { imageAlt: v })} recommendedDimensions="800 × 1100, 1080 × 1080, or 1400 × 900 px" acceptedFormats="JPG, PNG, or WebP" aspectRatio="4:5" usage="Public wins, shipment, or customer-safe image" saveState={saveState} /></div></div>)}</div> : null}

        {activeTab === 'Community Highlights' ? <div className="space-y-4"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.community.enabled} onChange={(e) => updateDraft((c) => ({ ...c, community: { ...c.community, enabled: e.target.checked } }))} /> Enable community section</label><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.community.hideWhenEmpty} onChange={(e) => updateDraft((c) => ({ ...c, community: { ...c.community, hideWhenEmpty: e.target.checked } }))} /> Hide when empty</label><div className="grid gap-3 sm:grid-cols-2"><Input value={draft.community.heading} onChange={(e) => updateDraft((c) => ({ ...c, community: { ...c.community, heading: e.target.value } }))} className="bg-[#111827] border-gray-700 text-white" /><Input value={draft.community.emptyMessage} onChange={(e) => updateDraft((c) => ({ ...c, community: { ...c.community, emptyMessage: e.target.value } }))} placeholder="Empty state message" className="bg-[#111827] border-gray-700 text-white" /></div><Textarea rows={2} value={draft.community.description} onChange={(e) => updateDraft((c) => ({ ...c, community: { ...c.community, description: e.target.value } }))} className="bg-[#111827] border-gray-700 text-white" /><button type="button" onClick={addCommunityItem} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-purple-400/30 px-4 text-sm font-bold text-purple-100"><Plus className="h-4 w-4" /> Add community item</button>{[...draft.community.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => <div key={item.id} className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-sm font-bold text-gray-200"><Input type="checkbox" checked={item.approved} onChange={(e) => patchCommunityItem(item.id, { approved: e.target.checked })} /> Approved</label><label className="flex items-center gap-2 text-sm font-bold text-gray-200"><Input type="checkbox" checked={item.published} onChange={(e) => patchCommunityItem(item.id, { published: e.target.checked })} /> Published</label></div><button type="button" onClick={() => setDeleteTarget({ type: 'community', id: item.id })} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-500/25 px-3 text-xs font-bold text-red-200"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input value={item.displayName} onChange={(e) => patchCommunityItem(item.id, { displayName: e.target.value })} placeholder="Pullz Collector" className="bg-[#111827] border-gray-700 text-white" /><Input value={item.sourceType} onChange={(e) => patchCommunityItem(item.id, { sourceType: e.target.value })} placeholder="Source type" className="bg-[#111827] border-gray-700 text-white" /><Input type="number" value={item.sortOrder} onChange={(e) => patchCommunityItem(item.id, { sortOrder: Number(e.target.value) })} placeholder="Sort" className="bg-[#111827] border-gray-700 text-white" /><Input value={item.createdDate} onChange={(e) => patchCommunityItem(item.id, { createdDate: e.target.value })} placeholder="Created date" className="bg-[#111827] border-gray-700 text-white" /></div><Textarea rows={2} value={item.caption} onChange={(e) => patchCommunityItem(item.id, { caption: e.target.value })} placeholder="Short caption" className="mt-3 bg-[#111827] border-gray-700 text-white" /><Input value={item.socialUrl} onChange={(e) => patchCommunityItem(item.id, { socialUrl: e.target.value })} placeholder="Optional social URL" className="mt-3 bg-[#111827] border-gray-700 text-white" /><div className="mt-3"><ImageUrlField label="Community Image" value={item.imageUrl} onChange={(v) => patchCommunityItem(item.id, { imageUrl: v })} altValue={item.imageAlt} onAltChange={(v) => patchCommunityItem(item.id, { imageAlt: v })} recommendedDimensions="1080 × 1350, 1080 × 1080, or 1400 × 900 px" acceptedFormats="JPG, PNG, or WebP" aspectRatio="4:5" usage="Approved community highlight image" saveState={saveState} /></div></div>)}</div> : null}

        {activeTab === 'Activity' ? <div className="space-y-4"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.activity.enabled} onChange={(e) => updateDraft((c) => ({ ...c, activity: { ...c.activity, enabled: e.target.checked } }))} /> Enable homepage activity</label><div className="grid gap-3 sm:grid-cols-2"><label><FieldLabel>Max items</FieldLabel><Input type="number" min={1} max={6} value={draft.activity.maxItems} onChange={(e) => updateDraft((c) => ({ ...c, activity: { ...c.activity, maxItems: Number(e.target.value) } }))} className="bg-[#111827] border-gray-700 text-white" /></label><label><FieldLabel>Refresh minutes</FieldLabel><Input type="number" min={5} max={120} value={draft.activity.refreshMinutes} onChange={(e) => updateDraft((c) => ({ ...c, activity: { ...c.activity, refreshMinutes: Number(e.target.value) } }))} className="bg-[#111827] border-gray-700 text-white" /></label></div><p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">Public activity reads only from the sanitized <code>homepageActivity</code> collection. Clients cannot write this feed.</p></div> : null}

        {activeTab === 'Social Links' ? <div className="space-y-4"><label className="flex items-center gap-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={draft.social.enabled} onChange={(e) => updateDraft((c) => ({ ...c, social: { ...c.social, enabled: e.target.checked } }))} /> Enable social CTA</label><div className="grid gap-3 sm:grid-cols-2"><Input value={draft.social.heading} onChange={(e) => updateDraft((c) => ({ ...c, social: { ...c.social, heading: e.target.value } }))} className="bg-[#111827] border-gray-700 text-white" /><Input value={draft.social.description} onChange={(e) => updateDraft((c) => ({ ...c, social: { ...c.social, description: e.target.value } }))} className="bg-[#111827] border-gray-700 text-white" /></div><ImageUrlField label="Community Banner" value={draft.social.bannerImageUrl} onChange={(v) => updateDraft((c) => ({ ...c, social: { ...c.social, bannerImageUrl: v } }))} altValue={draft.social.bannerImageAlt} onAltChange={(v) => updateDraft((c) => ({ ...c, social: { ...c.social, bannerImageAlt: v } }))} recommendedDimensions="1600 × 700 px" acceptedFormats="JPG, PNG, or WebP" aspectRatio="16:9" usage="Optional community CTA banner" saveState={saveState} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(['instagramUrl','tiktokUrl','discordUrl','xUrl','facebookUrl','youtubeUrl'] as const).map((key) => <label key={key}><FieldLabel>{key.replace('Url','')}</FieldLabel><Input value={draft.social[key]} onChange={(e) => updateDraft((c) => ({ ...c, social: { ...c.social, [key]: e.target.value } }))} placeholder="https://" className="bg-[#111827] border-gray-700 text-white" /></label>)}</div></div> : null}

        {activeTab === 'Homepage Visibility' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(draft.visibility).map(([key, value]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0b0e14] p-3 text-sm font-bold text-gray-200"><Input type="checkbox" checked={Boolean(value)} onChange={(e) => updateDraft((c) => ({ ...c, visibility: { ...c.visibility, [key]: e.target.checked } }))} /> {key}</label>)}<div className="sm:col-span-2 lg:col-span-3"><HomepageImagePlaceholder assetName="Admin image placeholders" dimensions="Multiple recommended sizes" format="PNG, WebP, JPG, or SVG depending on field" aspectRatio="16:9" usage="Public placeholders are hidden by default unless publicPlaceholders is enabled." /></div></div> : null}
      </div>

      {deleteTarget ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-[#131720] p-5"><h4 className="text-lg font-black text-white">Delete item?</h4><p className="mt-2 text-sm text-gray-400">This removes the draft item. Save changes to publish the deletion.</p><div className="mt-5 flex gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="min-h-10 flex-1 rounded-lg border border-gray-700 text-sm font-bold text-gray-200">Cancel</button><button type="button" onClick={removeItem} className="min-h-10 flex-1 rounded-lg border border-red-500/30 bg-red-500/15 text-sm font-bold text-red-100">Delete</button></div></div></div> : null}
    </section>
  );
};
