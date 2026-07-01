import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Check, ChevronDown, ChevronRight, Coins, Filter, PackageOpen, Search, ShieldCheck, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { CaseItem, InventoryItem } from '../../types';
import { authedFetch } from '../../utils/authedFetch';
import { trackEvent } from '../../utils/trackEvent';

type BuildItem = CaseItem & { value: number; primaryBoxId: string; primaryBoxName: string; sourceBoxes: { id: string; name: string }[] };
type QuoteItem = BuildItem & { chance: number; weight: number };
type Quote = { price: number; originalPrice: number; savings: number; expectedValue: number; targetRtp: number; items: QuoteItem[] };
const MIN_ITEMS = 5;
const categories = ['All', 'Cards', 'Packs', 'Slabs', 'Sealed', 'Popular'];
const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();
const valueOf = (item: any) => Number(item.valueCoins ?? item.value ?? item.price ?? 0);
const isActiveBox = (box: any) => !(box.disabled || box.enabled === false || box.hidden || box.isHidden || box.draft || box.status === 'draft' || box.public === false || box.isUserCreated);
const categoryOf = (item: BuildItem) => {
  const hay = `${item.category} ${item.name} ${(item.tags ?? []).join(' ')}`.toLowerCase();
  if (hay.includes('slab') || hay.includes('psa') || hay.includes('graded')) return 'Slabs';
  if (hay.includes('pack') || hay.includes('booster')) return 'Packs';
  if (hay.includes('sealed') || hay.includes('box') || hay.includes('etb')) return 'Sealed';
  return 'Cards';
};

export default function UpgraderPage() {
  const { boxes, isAuthenticated, openAuthModal, user, addInventoryItemFromServer } = useGame();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sourceBox, setSourceBox] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<{ prize: QuoteItem | null; inventoryId?: string } | null>(null);
  const quoteTimer = useRef<number | null>(null);

  useEffect(() => { trackEvent('build_box_view'); }, []);

  const activeBoxes = useMemo(() => boxes.filter(isActiveBox), [boxes]);
  const items = useMemo<BuildItem[]>(() => {
    const map = new Map<string, BuildItem>();
    activeBoxes.forEach((box) => (box.items ?? []).forEach((raw: any) => {
      const value = valueOf(raw);
      if (!raw || raw.disabled || raw.enabled === false || raw.hidden || !raw.image || value <= 0) return;
      if ((raw.stockTracked || raw.trackStock || raw.limitedStock) && Number(raw.stock ?? raw.quantity ?? raw.remainingStock ?? 0) <= 0) return;
      const key = norm(raw.itemId ?? raw.sourceItemId ?? raw.sku ?? raw.id ?? raw.name);
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        if (!existing.sourceBoxes.some((s) => s.id === box.id)) existing.sourceBoxes.push({ id: box.id, name: box.name });
        return;
      }
      map.set(key, { ...raw, id: key, price: value, value, chance: Number(raw.chance ?? raw.weight ?? 0), rarity: raw.rarity ?? 'common', color: raw.color ?? box.accentColor ?? '#8b5cf6', primaryBoxId: box.id, primaryBoxName: box.name, sourceBoxes: [{ id: box.id, name: box.name }] });
    }));
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [activeBoxes]);

  const visibleCategories = useMemo(() => categories.filter((cat) => cat === 'All' || cat === 'Popular' || items.some((item) => categoryOf(item) === cat)), [items]);
  const filtered = useMemo(() => {
    const q = norm(search);
    return items.filter((item) => {
      if (category !== 'All' && category !== 'Popular' && categoryOf(item) !== category) return false;
      if (category === 'Popular' && item.value < Math.max(500, items.reduce((s, i) => s + i.value, 0) / Math.max(1, items.length))) return false;
      if (sourceBox !== 'all' && !item.sourceBoxes.some((box) => box.id === sourceBox)) return false;
      if (!q) return true;
      return norm(`${item.name} ${item.primaryBoxName} ${item.category} ${item.rarity}`).includes(q);
    });
  }, [items, search, category, sourceBox]);
  const selectedItems = useMemo(() => selected.map((id) => items.find((i) => i.id === id)).filter(Boolean) as BuildItem[], [selected, items]);
  const hasVariety = useMemo(() => new Set(selectedItems.map((i) => Math.round(i.value))).size >= 2 || new Set(selectedItems.map((i) => i.rarity)).size >= 2, [selectedItems]);
  const canReview = selected.length >= MIN_ITEMS && hasVariety && Boolean(quote) && !quoteError;

  useEffect(() => {
    if (quoteTimer.current) window.clearTimeout(quoteTimer.current);
    setQuoteError('');
    if (selected.length < MIN_ITEMS || !hasVariety) { setQuote(null); return; }
    quoteTimer.current = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/build-box-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedItemIds: selected }) });
        const data = await response.json() as { ok: boolean; quote?: Quote; message?: string };
        if (!response.ok || !data.quote) throw new Error(data.message || 'Server calculation failed.');
        setQuote(data.quote);
      } catch (error: any) { setQuote(null); setQuoteError(error?.message || 'Server calculation failed.'); }
    }, 250);
  }, [selected.join('|'), hasVariety]);

  const toggle = (item: BuildItem) => setSelected((prev) => {
    const exists = prev.includes(item.id);
    trackEvent(exists ? 'build_box_item_remove' : 'build_box_item_add', { item_id: item.id, source_box_id: item.primaryBoxId });
    return exists ? prev.filter((id) => id !== item.id) : [...prev, item.id];
  });

  const openReview = async () => {
    if (!isAuthenticated) { openAuthModal('login'); return; }
    if (!canReview) return;
    trackEvent('build_box_review', { item_count: selected.length, price: quote?.price });
    setReviewOpen(true);
  };
  const buildAndOpen = async () => {
    if (!quote || opening) return;
    setOpening(true); setResult(null);
    try {
      const operationId = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const data = await authedFetch<any>('/api/open-build-box', { method: 'POST', body: JSON.stringify({ selectedItemIds: selected, operationId }) });
      const prize = data.prize as QuoteItem;
      addInventoryItemFromServer({ ...(prize as any), id: prize.id, price: Number(prize.value ?? prize.price ?? 0), instanceId: data.inventoryId, obtainedAt: Date.now(), status: 'available', provenance: { sourceType: 'case_open', sourceId: 'build-box' } } as InventoryItem);
      trackEvent('build_box_purchase', { item_count: selected.length, price: data.price });
      trackEvent('build_box_open_success', { open_id: data.openId, price: data.price });
      setResult({ prize, inventoryId: data.inventoryId });
    } catch (error: any) { trackEvent('build_box_open_failure', { error: error?.message }); setQuoteError(error?.message || 'Purchase failed.'); }
    finally { setOpening(false); }
  };
  const totalLabel = (quote?.price ?? 0).toLocaleString();
  return <div className="min-h-screen bg-[#03060d] pb-56 text-white lg:pb-16">
    <main className="mx-auto max-w-7xl px-3 pt-3 sm:px-5 lg:px-8">
      <section className="relative mb-4 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[radial-gradient(circle_at_75%_20%,rgba(124,58,237,.38),transparent_32%),linear-gradient(135deg,#070b16,#0b1020_55%,#03060d)] p-5 shadow-[0_0_50px_rgba(59,130,246,.18)] sm:p-8">
        <div className="relative z-10 max-w-[68%] sm:max-w-xl"><h1 className="bg-gradient-to-r from-white via-sky-200 to-violet-400 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl">BUILD A BOX</h1><p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">Choose items from across Pullz boxes and create your own custom pull pool.</p></div>
        <div className="absolute -right-3 bottom-0 top-2 grid w-[38%] place-items-center"><PackageOpen className="h-28 w-28 text-violet-300 drop-shadow-[0_0_28px_rgba(139,92,246,.8)] sm:h-44 sm:w-44" /></div>
      </section>
      <div className="sticky top-2 z-30 mb-4 space-y-3 bg-[#03060d]/95 pb-2 pt-1">
        <div className="flex h-16 items-center gap-3 rounded-2xl border border-white/10 bg-[#0b111a] px-4 shadow-inner"><Search className="h-6 w-6 text-slate-400" /><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search cards, packs, slabs..." className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500" /><Filter className="h-5 w-5 text-slate-300" /></div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">{visibleCategories.map((cat)=><button key={cat} onClick={()=>setCategory(cat)} className={`shrink-0 rounded-2xl border px-6 py-3 text-sm font-bold ${category===cat?'border-violet-400 bg-violet-500/20 text-white shadow-[0_0_18px_rgba(99,102,241,.45)]':'border-white/10 bg-white/[.06] text-slate-200'}`}>{cat==='Popular'?'🔥 Popular':cat}</button>)}</div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1"><button onClick={()=>setSourceBox('all')} className={`shrink-0 rounded-xl border px-4 py-3 text-sm ${sourceBox==='all'?'border-sky-400 bg-sky-500/15':'border-white/10 bg-white/[.04]'}`}><Box className="mr-2 inline h-4 w-4 text-violet-300"/>All Boxes</button>{activeBoxes.map((box)=><button key={box.id} onClick={()=>setSourceBox(box.id)} className={`shrink-0 rounded-xl border px-4 py-3 text-sm ${sourceBox===box.id?'border-sky-400 bg-sky-500/15':'border-white/10 bg-white/[.04]'}`}>From {box.name}</button>)}</div>
      </div>
      {!activeBoxes.length ? <State title="No active boxes" text="Build a Box will appear when public boxes with eligible items are available."/> : !filtered.length ? <State title="No matching items" text="Try another search, category, or source box."/> : null}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_340px]"><div className="grid grid-cols-2 gap-3 sm:col-span-3 sm:grid-cols-3 lg:col-span-1 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((item)=>{const s=selected.includes(item.id);return <button key={item.id} onClick={()=>toggle(item)} className={`group relative min-h-[255px] rounded-2xl border bg-[#0a1018] p-3 text-left transition ${s?'border-violet-400 shadow-[0_0_0_1px_rgba(139,92,246,.7),0_0_24px_rgba(59,130,246,.22)]':'border-white/10 hover:border-sky-400/60'}`}><span className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border ${s?'border-violet-300 bg-violet-500 text-white':'border-white/25 bg-black/45'}`}>{s?<Check className="h-5 w-5"/>:<span className="text-2xl leading-none">+</span>}</span><div className="mb-3 grid h-32 place-items-center rounded-xl bg-black/25"><img src={item.image} alt="" loading="lazy" className="max-h-28 max-w-full object-contain" /></div><h3 className="line-clamp-2 min-h-[42px] text-base font-black">{item.name}</h3><p className="mt-1 truncate text-sm font-semibold text-violet-300">From {item.primaryBoxName}</p><div className="mt-2 flex items-center justify-between"><span className="rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase text-slate-300">{item.rarity}</span><span className="flex items-center gap-1 text-lg font-black"><Coins className="h-5 w-5 text-yellow-300"/>{item.value.toLocaleString()}</span></div><span className="mt-3 flex h-10 items-center justify-center rounded-lg border border-violet-500/70 text-sm font-bold">{s?'Remove':'＋ Add'}</span></button>})}</div><aside className="hidden lg:block"><Summary selectedItems={selectedItems} quote={quote} quoteError={quoteError} minOk={selected.length>=MIN_ITEMS} varietyOk={hasVariety} onRemove={(id)=>setSelected((p)=>p.filter((x)=>x!==id))} onReview={openReview} canReview={canReview} /></aside></div>
    </main>
    <div className="fixed bottom-[calc(var(--pullz-mobile-bottom-nav-height,72px)+8px)] left-3 right-3 z-40 lg:hidden"><Summary selectedItems={selectedItems} quote={quote} quoteError={quoteError} minOk={selected.length>=MIN_ITEMS} varietyOk={hasVariety} onRemove={(id)=>setSelected((p)=>p.filter((x)=>x!==id))} onReview={openReview} canReview={canReview} compact open={summaryOpen} setOpen={setSummaryOpen}/></div>
    {reviewOpen && <div className="fixed inset-0 z-[300] flex items-end bg-black/70 p-3 sm:items-center sm:justify-center"><div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0b111a] p-4 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Review Your Box</h2><button onClick={()=>setReviewOpen(false)}><X/></button></div>{result ? <div className="py-8 text-center"><img src={result.prize?.image} className="mx-auto h-44 object-contain"/><h3 className="mt-4 text-2xl font-black">You pulled {result.prize?.name}!</h3><p className="text-slate-400">One winning item was added to your inventory.</p></div> : <><p className="mt-2 text-sm text-slate-300">You are choosing the possible pulls inside this box. One item will be selected when you open it.</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="Items" value={selected.length}/><Metric label="Price" value={`${totalLabel}`}/><Metric label="EV" value={`${quote?.expectedValue?.toLocaleString() ?? '—'}`}/></div><div className="mt-4 max-h-[42vh] space-y-2 overflow-auto pr-1">{quote?.items.map((item)=><div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/[.04] p-2"><img src={item.image} className="h-12 w-12 object-contain"/><div className="min-w-0 flex-1"><p className="truncate font-bold">{item.name}</p><p className="text-xs text-slate-400">{item.value.toLocaleString()} coins • {item.chance.toFixed(4)}%</p></div></div>)}</div><p className="mt-3 text-xs text-slate-400">Highest pull: {selectedItems.reduce((a,b)=>a.value>b.value?a:b, selectedItems[0])?.name}. Lowest pull: {selectedItems.reduce((a,b)=>a.value<b.value?a:b, selectedItems[0])?.name}.</p><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={()=>setReviewOpen(false)} className="h-12 rounded-xl border border-white/15 font-bold">Edit Box</button><button onClick={buildAndOpen} disabled={opening} className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-sky-400 font-black disabled:opacity-60">{opening?'Opening…':`Build & Open — ${totalLabel} Coins`}</button></div></>}{quoteError && <p className="mt-3 text-sm text-red-300">{quoteError}</p>}</div></div>}
  </div>;
}
function State({title,text}:{title:string;text:string}){return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-8 text-center"><p className="text-xl font-black">{title}</p><p className="mt-2 text-slate-400">{text}</p></div>}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl bg-white/[.04] p-3"><p className="text-xs text-slate-400">{label}</p><p className="font-black">{value}</p></div>}
function Summary({selectedItems,quote,quoteError,minOk,varietyOk,onRemove,onReview,canReview,compact,open,setOpen}:any){return <div className="sticky top-4 rounded-2xl border border-white/15 bg-[#0c121b] shadow-[0_0_34px_rgba(0,0,0,.55)]"><div className="flex items-center justify-between p-4"><div><p className="text-lg font-black">{selectedItems.length} items selected</p>{!minOk?<p className="text-xs text-amber-300">Choose at least 5 possible pulls to build your box.</p>:!varietyOk?<p className="text-xs text-amber-300">Choose at least two values or rarity tiers.</p>:<p className="text-xs text-emerald-300">Custom pool ready</p>}</div>{compact&&<button onClick={()=>setOpen?.(!open)}><ChevronDown className={open?'rotate-180':''}/></button>}</div>{(!compact||open)&&<div className="border-t border-white/10 p-4"><div className="no-scrollbar flex gap-2 overflow-x-auto pb-3">{selectedItems.map((item:any)=><div key={item.id} className="relative shrink-0"><img src={item.image} className="h-14 w-12 rounded-md border border-white/10 object-contain bg-black/30"/><button onClick={()=>onRemove(item.id)} className="absolute -right-2 -top-2 rounded-full bg-black p-0.5"><X className="h-3 w-3"/></button></div>)}</div><div className="flex items-end justify-between"><div><p className="text-sm font-bold">Box Total</p><p className="text-4xl font-black"><Coins className="mr-1 inline h-8 w-8 text-yellow-300"/>{(quote?.price??0).toLocaleString()}</p>{quote?.savings>0?<p className="text-sm text-green-400">You save {quote.savings.toLocaleString()} coins!</p>:null}</div><ShieldCheck className="h-5 w-5 text-sky-300"/></div>{quoteError&&<p className="mt-2 text-xs text-red-300">{quoteError}</p>}</div>}<button onClick={onReview} disabled={!canReview} className="m-3 flex h-14 w-[calc(100%-1.5rem)] items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600 to-sky-400 px-5 text-lg font-black disabled:opacity-45"><Box/>Build Box — {(quote?.price??0).toLocaleString()} Coins<ChevronRight/></button></div>}
