import React, { useMemo, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { RefreshCw, CheckCircle2, XCircle, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { CaseItem, MarketPricingCondition, MarketPricingSource, MysteryBox } from '../../types';
import { db } from '../../firebase';
import { authedFetch } from '../../utils/authedFetch';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

const sources: MarketPricingSource[] = ['tcgplayer'];
const conditions: MarketPricingCondition[] = ['raw', 'near_mint', 'lightly_played', 'psa_9', 'psa_10', 'sealed'];

type FilterKey = 'pending' | 'failed' | 'locked' | 'enabled' | 'danger';

type Props = {
  items: CaseItem[];
  boxes: MysteryBox[];
  activeBox?: MysteryBox | null;
  selectedItemIds?: string[];
  compact?: boolean;
  onItemsUpdated?: (items: CaseItem[]) => void;
};

const coinsToUsd = (coins?: number) => Math.round(Math.max(0, Number(coins || 0)) / 100 * 100) / 100;
const usdToCoins = (usd?: number) => Math.max(0, Math.round(Number(usd || 0) * 100));
const sellBack = (coins?: number) => Math.max(0, Math.floor(Number(coins || 0) * 0.8));

const formatDate = (value: any) => {
  if (!value) return 'Never';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value.seconds ? value.seconds * 1000 : value);
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
};

const statusClass = (status?: string, locked?: boolean) => {
  if (locked) return 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200';
  if (status === 'approved') return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200';
  if (status === 'pending_review') return 'border-amber-400/40 bg-amber-400/10 text-amber-200';
  if (status === 'failed') return 'border-red-400/40 bg-red-400/10 text-red-200';
  return 'border-gray-600 bg-white/5 text-gray-300';
};

const auditClass = (status?: string) => {
  if (status === 'healthy') return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200';
  if (status === 'warning') return 'border-amber-400/40 bg-amber-400/10 text-amber-200';
  if (status === 'danger') return 'border-red-400/40 bg-red-400/10 text-red-200';
  return 'border-gray-600 bg-white/5 text-gray-300';
};

export const MarketPricingAdminSection: React.FC<Props> = ({ items, boxes, activeBox = null, selectedItemIds, compact = false, onItemsUpdated }) => {
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({ pending: false, failed: false, locked: false, enabled: false, danger: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<CaseItem['marketPricing']>>>({});

  const dangerItemIds = useMemo(() => {
    const ids = new Set<string>();
    boxes.filter((box) => box.marketValueAudit?.status === 'danger').forEach((box) => box.items.forEach((item) => ids.add(item.id)));
    return ids;
  }, [boxes]);

  const selectedIdSet = useMemo(() => new Set((selectedItemIds ?? []).map(String)), [selectedItemIds]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (selectedItemIds && !selectedIdSet.has(String(item.id))) return false;
    const pricing = { ...(item.marketPricing || {}), ...(drafts[item.id] || {}) };
    if (filters.pending && pricing.updateStatus !== 'pending_review') return false;
    if (filters.failed && pricing.updateStatus !== 'failed') return false;
    if (filters.locked && pricing.valueLocked !== true) return false;
    if (filters.enabled && pricing.enabled !== true) return false;
    if (filters.danger && !dangerItemIds.has(item.id)) return false;
    return true;
  }), [dangerItemIds, drafts, filters, items, selectedIdSet, selectedItemIds]);

  const runAction = async (label: string, action: () => Promise<any>) => {
    setBusy(label);
    setMessage(null);
    try {
      const result = await action();
      setMessage(result?.checked != null ? `Checked ${result.checked}, updated ${result.updated}, pending ${result.pendingReview}, failed ${result.failed}. Latest values are loaded into the editor.` : 'Saved. Latest values are loaded into the editor.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Request failed';
      setMessage(text);
    } finally {
      setBusy(null);
    }
  };


  const removeUndefined = <T extends Record<string, unknown>>(value: T): T =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

  const saveMarketPricingConfig = async (item: CaseItem, overrides: Partial<NonNullable<CaseItem['marketPricing']>> = {}) => {
    const draft = { ...(drafts[item.id] || {}), ...overrides };
    const existing = item.marketPricing || { enabled: false, source: 'manual' as MarketPricingSource };
    const approvedValueUsd = draft.approvedValueUsd != null ? Math.max(0, Number(draft.approvedValueUsd)) : existing.approvedValueUsd;
    const approvedValueCoins = draft.approvedValueCoins != null ? Math.max(0, Math.round(Number(draft.approvedValueCoins))) : (approvedValueUsd != null ? usdToCoins(approvedValueUsd) : existing.approvedValueCoins);
    const approvedSellBackCoins = draft.approvedSellBackCoins != null ? Math.max(0, Math.floor(Number(draft.approvedSellBackCoins))) : (approvedValueCoins != null ? sellBack(approvedValueCoins) : existing.approvedSellBackCoins);
    const marketPricing = removeUndefined({
      ...existing,
      enabled: draft.enabled ?? existing.enabled ?? false,
      source: 'tcgplayer' as MarketPricingSource,
      sourceId: draft.sourceId ?? existing.sourceId,
      query: draft.query ?? existing.query,
      condition: draft.condition ?? existing.condition,
      valueLocked: draft.valueLocked ?? existing.valueLocked ?? false,
      approvedValueUsd,
      approvedValueCoins,
      approvedSellBackCoins
    });

    await updateDoc(doc(db, 'items', item.id), { marketPricing });
    setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], ...marketPricing } }));
    return marketPricing;
  };

  const refreshMarketPricingDraft = async (itemId: string) => {
    const snapshot = await getDoc(doc(db, 'items', itemId));
    const marketPricing = snapshot.exists() ? snapshot.data().marketPricing : null;
    if (marketPricing) {
      setDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...marketPricing } }));
    }
  };

  const loadFreshItems = async (itemIds: string[]) => {
    const freshItems: CaseItem[] = [];
    await Promise.all(itemIds.map(async (itemId) => {
      const snapshot = await getDoc(doc(db, 'items', itemId));
      if (!snapshot.exists()) return;
      const data = snapshot.data() as Omit<CaseItem, 'id'>;
      freshItems.push({ id: snapshot.id, ...data });
      if (data.marketPricing) {
        setDrafts((prev) => ({ ...prev, [snapshot.id]: { ...prev[snapshot.id], ...data.marketPricing } }));
      }
    }));
    if (freshItems.length > 0) onItemsUpdated?.(freshItems);
    return freshItems;
  };

  const checkPrice = async (item: CaseItem) => {
    // Save current dropdown/input drafts first so the server route reads fresh Firestore config.
    await saveMarketPricingConfig(item, { enabled: true, source: 'tcgplayer' });
    const result = await authedFetch('/api/admin/market-prices/update', { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
    await loadFreshItems([item.id]);
    return result;
  };

  const checkActiveBoxPrices = async () => {
    const boxItemIds = visibleItems.map((item) => item.id);
    await Promise.all(visibleItems.map((item) => saveMarketPricingConfig(item, { enabled: true, source: 'tcgplayer' })));
    const result = await authedFetch('/api/admin/market-prices/update', {
      method: 'POST',
      body: JSON.stringify(activeBox?.id ? { boxId: activeBox.id, itemIds: boxItemIds } : { itemIds: boxItemIds })
    });
    await loadFreshItems(boxItemIds);
    return result;
  };

  const toggleLock = async (item: CaseItem, locked: boolean) => {
    await saveMarketPricingConfig(item, { valueLocked: locked });
  };

  const saveConfig = async (item: CaseItem) => {
    const marketPricing = await saveMarketPricingConfig(item);
    if (marketPricing.approvedValueCoins != null) {
      await updateDoc(doc(db, 'items', item.id), removeUndefined({
        valueUsd: marketPricing.approvedValueUsd ?? coinsToUsd(marketPricing.approvedValueCoins),
        valueCoins: marketPricing.approvedValueCoins,
        sellBackCoins: marketPricing.approvedSellBackCoins ?? sellBack(marketPricing.approvedValueCoins),
        price: marketPricing.approvedValueCoins
      }));
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gray-800 bg-[#131720] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">{compact ? 'Box Market Pricing' : 'Market Pricing'}</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-400">Use TCGplayer source IDs to refresh selected item prices, then auto-recalculate box odds against the editor target EV.</p>
          </div>
          <button
            onClick={() => runAction(compact ? 'update-box' : 'update-all', compact ? checkActiveBoxPrices : () => authedFetch('/api/admin/market-prices/update', { method: 'POST', body: JSON.stringify({}) }))}
            disabled={busy !== null || (compact && visibleItems.length === 0)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${busy === 'update-all' || busy === 'update-box' ? 'animate-spin' : ''}`} /> {compact ? `Update ${activeBox?.name || 'Box'} Prices` : 'Run Daily Update'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(!compact ? [
            ['pending', 'Pending Review'], ['failed', 'Failed'], ['locked', 'Locked'], ['enabled', 'Auto-update enabled'], ['danger', 'Box margin danger']
          ] : [
            ['pending', 'Pending Review'], ['failed', 'Failed'], ['locked', 'Locked'], ['enabled', 'Auto-update enabled']
          ] as [FilterKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilters((prev) => ({ ...prev, [key]: !prev[key] }))} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filters[key] ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100' : 'border-gray-700 text-gray-400'}`}>{label}</button>
          ))}
        </div>
        {message && <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">{message}</div>}

        <div className="mt-5 grid grid-cols-1 gap-4">
          {visibleItems.map((item) => {
            const pricing = { ...(item.marketPricing || { source: 'manual' as MarketPricingSource, enabled: false }), ...(drafts[item.id] || {}) };
            const currentCoins = item.valueCoins ?? item.price ?? 0;
            const suggestedCoins = pricing.suggestedValueCoins;
            const diff = currentCoins > 0 && suggestedCoins != null ? Math.round(((suggestedCoins - currentCoins) / currentCoins) * 1000) / 10 : null;
            const rowBusy = busy?.endsWith(item.id);
            return (
              <article key={item.id} className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4 shadow-xl shadow-black/10">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,1.2fr)_minmax(360px,2fr)_auto] xl:items-start">
                  <div className="flex min-w-0 gap-3">
                    <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover" loading="lazy" decoding="async" width={64} height={64} />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-white">{item.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(pricing.updateStatus, pricing.valueLocked)}`}>{pricing.valueLocked ? 'Locked' : (pricing.updateStatus || 'idle').replace('_', ' ')}</span>
                        {dangerItemIds.has(item.id) && <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-1 text-[10px] font-bold uppercase text-red-200">Box danger</span>}
                      </div>
                      {pricing.lastError && <p className="mt-2 text-xs text-red-300">{pricing.lastError}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div><span className="text-gray-500">Live</span><p className="font-bold text-white">{currentCoins} coins (${coinsToUsd(currentCoins).toFixed(2)})</p></div>
                    <div><span className="text-gray-500">Suggested</span><p className="font-bold text-white">{suggestedCoins ?? '—'} {suggestedCoins != null ? `coins ($${(pricing.suggestedValueUsd ?? coinsToUsd(suggestedCoins)).toFixed(2)})` : ''}</p></div>
                    <div><span className="text-gray-500">Diff</span><p className={`${diff != null && Math.abs(diff) > 15 ? 'text-amber-300' : 'text-gray-200'} font-bold`}>{diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff}%`}</p></div>
                    <div><span className="text-gray-500">Sell-back</span><p className="font-bold text-white">{item.sellBackCoins ?? sellBack(currentCoins)} → {pricing.suggestedSellBackCoins ?? '—'}</p></div>
                    <div><span className="text-gray-500">Source</span><p className="font-bold text-white">{pricing.source || 'manual'}</p></div>
                    <div><span className="text-gray-500">Condition</span><p className="font-bold text-white">{pricing.condition || '—'}</p></div>
                    <div className="col-span-2"><span className="text-gray-500">Last checked</span><p className="font-bold text-white">{formatDate(pricing.lastCheckedAt)}</p></div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button disabled={rowBusy} onClick={() => runAction(`check-${item.id}`, () => checkPrice(item))} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-bold text-cyan-100">Check Price</button>
                    <button disabled={rowBusy} onClick={() => runAction(`approve-${item.id}`, () => authedFetch('/api/admin/market-prices/approve', { method: 'POST', body: JSON.stringify({ itemId: item.id }) }))} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-bold text-emerald-100"><CheckCircle2 className="mr-1 inline h-3 w-3" />Approve</button>
                    <button disabled={rowBusy} onClick={() => runAction(`reject-${item.id}`, () => authedFetch('/api/admin/market-prices/reject', { method: 'POST', body: JSON.stringify({ itemId: item.id }) }))} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-100"><XCircle className="mr-1 inline h-3 w-3" />Reject</button>
                    <button onClick={() => runAction(`lock-${item.id}`, () => toggleLock(item, !pricing.valueLocked))} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-200">{pricing.valueLocked ? <Unlock className="mr-1 inline h-3 w-3" /> : <Lock className="mr-1 inline h-3 w-3" />}{pricing.valueLocked ? 'Unlock' : 'Lock'} Value</button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-7">
                  <label className="text-[11px] font-bold uppercase text-gray-500">Enabled<Select value={String(pricing.enabled ?? false)} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], enabled: e.target.value === 'true' } }))} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white"><option value="false">No</option><option value="true">Yes</option></Select></label>
                  <label className="text-[11px] font-bold uppercase text-gray-500">Source<Select value="tcgplayer" onChange={() => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], source: 'tcgplayer' } }))} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white">{sources.map((source) => <option key={source} value={source}>{source}</option>)}</Select></label>
                  <label className="text-[11px] font-bold uppercase text-gray-500">Source ID<Input value={pricing.sourceId || ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], sourceId: e.target.value } }))} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white" /></label>
                  <label className="text-[11px] font-bold uppercase text-gray-500">Query<Input value={pricing.query || ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], query: e.target.value } }))} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white" /></label>
                  <label className="text-[11px] font-bold uppercase text-gray-500">Condition<Select value={pricing.condition || 'raw'} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], condition: e.target.value as MarketPricingCondition } }))} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white">{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</Select></label>
                  <label className="text-[11px] font-bold uppercase text-gray-500">Approved USD<Input type="number" min="0" value={pricing.approvedValueUsd ?? ''} onChange={(e) => { const usd = Math.max(0, Number(e.target.value)); const coins = usdToCoins(usd); setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], approvedValueUsd: usd, approvedValueCoins: coins, approvedSellBackCoins: sellBack(coins) } })); }} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white" /></label>
                  <label className="text-[11px] font-bold uppercase text-gray-500">Approved Coins<Input type="number" min="0" value={pricing.approvedValueCoins ?? ''} onChange={(e) => { const coins = Math.max(0, Math.round(Number(e.target.value))); setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], approvedValueCoins: coins, approvedValueUsd: coinsToUsd(coins), approvedSellBackCoins: sellBack(coins) } })); }} className="mt-1 w-full rounded bg-[#131720] p-2 text-sm text-white" /></label>
                </div>
                <p className="mt-2 text-xs text-gray-500">Source ID must be the TCGplayer product ID for this item. Use query only as a fallback search hint.</p>
                <div className="mt-3 flex justify-end"><button onClick={() => runAction(`save-${item.id}`, () => saveConfig(item))} className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15">Save TCGplayer Config</button></div>
              </article>
            );
          })}
        </div>
      </section>

      {!compact && <section className="rounded-2xl border border-gray-800 bg-[#131720] p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-300" /><h2 className="text-xl font-black text-white">Box Value Audit</h2></div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {boxes.map((box) => {
            const audit = box.marketValueAudit;
            return <div key={box.id} className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-bold text-white">{box.name}</h3><p className="text-xs text-gray-500">Last checked: {formatDate(audit?.lastCheckedAt)}</p></div>
                <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${auditClass(audit?.status)}`}>{audit?.status || 'not checked'}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div><span className="text-xs text-gray-500">Box price</span><p className="font-bold text-white">{audit?.boxPriceCoins ?? box.price}</p></div>
                <div><span className="text-xs text-gray-500">EV</span><p className="font-bold text-white">{audit?.expectedValueCoins ?? '—'}</p></div>
                <div><span className="text-xs text-gray-500">Margin</span><p className="font-bold text-white">{audit?.marginCoins ?? '—'}</p></div>
                <div><span className="text-xs text-gray-500">Margin %</span><p className="font-bold text-white">{audit ? `${Math.round(audit.marginPercent * 1000) / 10}%` : '—'}</p></div>
                <div><span className="text-xs text-gray-500">Needs review</span><p className={audit?.needsReview ? 'font-bold text-red-300' : 'font-bold text-emerald-300'}>{audit?.needsReview ? 'Yes' : 'No'}</p></div>
              </div>
            </div>;
          })}
        </div>
      </section>}
    </div>
  );
};
