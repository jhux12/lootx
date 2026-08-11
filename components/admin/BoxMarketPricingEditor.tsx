import React, { useState } from 'react';
import { AlertTriangle, Link2, Search } from 'lucide-react';
import { CaseItem, MysteryBox } from '../../types';
import { authedFetch } from '../../utils/authedFetch';

type Variant = { key: string; label: string; marketPriceCoins: number; marketPriceCents: number; updatedAt?: string | null };
type Match = { tcgdexId: string; name: string; image?: string | null; set?: string | null; cardNumber?: string | null; rarity?: string | null; productId: string; providerUpdatedAt?: string | null; variants: Variant[] };
type ItemState = { url: string; canonicalUrl?: string; productId?: string; matches: Match[]; selectedCard?: string; selectedVariant?: string; busy?: boolean; error?: string; applied?: string };
const money = (coins?: number | null) => coins == null ? '—' : `$${(coins / 100).toFixed(2)}`;

export const BoxMarketPricingEditor = ({ box, items, onItemsChange }: { box: MysteryBox; items: CaseItem[]; onItemsChange: (items: CaseItem[]) => void }) => {
  const [states, setStates] = useState<Record<string, ItemState>>(() => Object.fromEntries(items.map((item) => [item.id, { url: item.tcgplayerUrl || '', matches: [] }])));
  const patchState = (id: string, patch: Partial<ItemState>) => setStates((current) => ({ ...current, [id]: { url: '', matches: [], ...current[id], ...patch } }));
  const findMatch = async (item: CaseItem) => {
    const state = states[item.id] || { url: '', matches: [] }; patchState(item.id, { busy: true, error: undefined, applied: undefined, matches: [] });
    try {
      const result: any = await authedFetch(`/api/admin/boxes/${box.id}/pricing/match`, { method: 'POST', body: JSON.stringify({ itemId: item.id, tcgplayerUrl: state.url }) });
      const matches: Match[] = result.matches || [];
      patchState(item.id, { busy: false, matches, canonicalUrl: result.canonicalUrl, productId: result.productId, selectedCard: matches.length === 1 ? matches[0].tcgdexId : undefined, selectedVariant: matches.length === 1 && matches[0].variants.length === 1 ? matches[0].variants[0].key : undefined, error: matches.length ? undefined : 'Automatic price unavailable' });
    } catch (error) { patchState(item.id, { busy: false, error: error instanceof Error ? error.message : 'Automatic price unavailable' }); }
  };
  const applyPrice = async (item: CaseItem) => {
    const state = states[item.id], match = state?.matches.find((entry) => entry.tcgdexId === state.selectedCard), variant = match?.variants.find((entry) => entry.key === state.selectedVariant);
    if (!state || !match || !variant) return patchState(item.id, { error: 'Choose an exact card and available market-price variant.' });
    patchState(item.id, { busy: true, error: undefined });
    try {
      await authedFetch(`/api/admin/boxes/${box.id}/pricing/apply`, { method: 'POST', body: JSON.stringify({ itemId: item.id, tcgplayerUrl: state.canonicalUrl || state.url, tcgdexId: match.tcgdexId, pricingVariant: variant.key }) });
      onItemsChange(items.map((entry) => entry.id === item.id ? { ...entry, tcgplayerUrl: state.canonicalUrl, tcgplayerProductId: state.productId, tcgdexId: match.tcgdexId, pricingVariant: variant.key as CaseItem['pricingVariant'], marketPriceCoins: variant.marketPriceCoins, marketPriceCents: variant.marketPriceCents, priceSource: 'tcgdex_tcgplayer', effectiveValue: variant.marketPriceCoins, price: variant.marketPriceCoins, valueCoins: variant.marketPriceCoins } : entry));
      patchState(item.id, { busy: false, applied: `${variant.label} price ${money(variant.marketPriceCoins)} applied to this box only.` });
    } catch (error) { patchState(item.id, { busy: false, error: error instanceof Error ? error.message : 'Price could not be applied.' }); }
  };
  return <section className="mt-5 rounded-2xl border border-cyan-500/30 bg-[#0b0e14] p-3 sm:p-5">
    <h4 className="font-black text-white">Market Pricing</h4>
    <p className="mt-1 text-xs text-amber-200"><AlertTriangle className="mr-1 inline h-4 w-4"/>Paste a TCGplayer product link to find exact TCGdex reference pricing for raw Pokémon cards. These prices do not represent PSA, CGC, BGS, or sealed products.</p>
    <div className="mt-5 space-y-4">{items.map((item) => { const state = states[item.id] || { url: '', matches: [] }; const match = state.matches.find((entry) => entry.tcgdexId === state.selectedCard); return <article key={item.id} className="rounded-xl border border-white/10 p-3 sm:p-4">
      <div className="flex items-center gap-3"><img src={item.image} alt="" className="h-12 w-12 rounded-lg object-contain"/><div className="min-w-0"><b className="block truncate text-sm text-white">{item.name}</b><span className="text-xs text-gray-400">Current value {money(item.effectiveValue ?? item.price)}</span></div></div>
      <label className="mt-3 block text-xs font-bold text-gray-300">Paste TCGplayer Link<div className="mt-1 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Link2 className="absolute left-3 top-3.5 h-4 w-4 text-gray-500"/><input type="url" value={state.url} onChange={(event) => patchState(item.id, { url: event.target.value })} placeholder="https://www.tcgplayer.com/product/660414/..." className="min-h-11 w-full rounded-xl border border-gray-700 bg-[#131720] pl-10 pr-3 text-sm text-white"/></div><button type="button" disabled={state.busy || !state.url} onClick={() => findMatch(item)} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50"><Search className="mr-2 inline h-4 w-4"/>{state.busy ? 'Finding…' : 'Find Card'}</button></div></label>
      {state.matches.length > 1 && <label className="mt-3 block text-xs text-gray-300">Multiple exact product-ID matches found. Choose a card.<select value={state.selectedCard || ''} onChange={(event) => patchState(item.id, { selectedCard: event.target.value, selectedVariant: undefined })} className="mt-1 min-h-11 w-full rounded-xl bg-[#131720] px-3 text-white"><option value="">Choose exact card…</option>{state.matches.map((entry) => <option key={entry.tcgdexId} value={entry.tcgdexId}>{entry.name} • {entry.set} • {entry.cardNumber}</option>)}</select></label>}
      {match && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="flex flex-col gap-3 sm:flex-row"><img src={match.image || item.image} alt={match.name} className="h-28 w-24 self-center rounded-lg object-contain sm:self-start"/><div className="min-w-0 flex-1"><h5 className="font-bold text-white">{match.name}</h5><div className="mt-1 grid grid-cols-2 gap-1 text-xs text-gray-300 sm:grid-cols-3"><span>Set: <b>{match.set || '—'}</b></span><span>Card: <b>{match.cardNumber || '—'}</b></span><span>Rarity: <b>{match.rarity || '—'}</b></span><span className="col-span-2 sm:col-span-3">TCGplayer product ID: <b>{match.productId}</b></span></div><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{match.variants.map((variant) => <button type="button" key={variant.key} onClick={() => patchState(item.id, { selectedVariant: variant.key })} className={`min-h-11 rounded-lg border px-3 text-left text-xs ${state.selectedVariant === variant.key ? 'border-cyan-400 bg-cyan-400/10 text-white' : 'border-gray-700 text-gray-300'}`}><b className="block">{variant.label}</b>{money(variant.marketPriceCoins)}</button>)}</div>{!match.variants.length && <p className="mt-3 text-sm text-amber-300">Automatic price unavailable</p>}<p className="mt-2 text-[11px] text-gray-500">Provider updated: {match.providerUpdatedAt || match.variants.find((entry) => entry.updatedAt)?.updatedAt || 'Not supplied'}</p><button type="button" disabled={state.busy || !state.selectedVariant} onClick={() => applyPrice(item)} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50 sm:w-auto">Apply Price</button></div></div></div>}
      {state.error && <p className="mt-3 text-sm font-bold text-amber-300">{state.error}. Current manual value was retained.</p>}{state.applied && <p className="mt-3 text-sm font-bold text-emerald-300">{state.applied}</p>}
    </article>; })}</div>
  </section>;
};
