import React, { useEffect, useMemo, useState } from 'react';
import { LucideArrowUpRight, LucideChevronRight, LucideLoader2, LucidePackage, LucideSparkles, LucideTarget } from 'lucide-react';
import { InventoryItem, Item, Rarity } from '../components/upgrader/upgraderTypes';
import { useGame } from '../../context/GameContext';
import { attemptUpgrade, getUpgraderSettings, getUpgraderTargets } from '../../services/upgraderService';
import { computeUpgradeChance, UpgraderSettings } from '../../utils/upgrader';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { CoinAmount } from '../../components/CoinAmount';
import { toast } from '../ui/toast/toast';

const rarityMap: Record<string, Rarity> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic'
};

const rarityTone: Record<Rarity, string> = {
  Common: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
  Uncommon: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  Rare: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  Epic: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  Legendary: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  Mythic: 'text-rose-300 border-rose-500/30 bg-rose-500/10'
};

type SortBy = 'bestChance' | 'highestValue' | 'lowestValue' | 'rarity';
type QuickFilter = 'bestChance' | 'nearUpgrades' | 'premiumTargets' | 'popular';

interface TargetBox {
  id: string;
  name: string;
  imageUrl: string;
  items: Item[];
  minValue: number;
  maxValue: number;
  featured: Item[];
}

const formatChance = (value: number) => `${Math.max(0.01, value).toFixed(value < 1 ? 2 : 1)}%`;

const sortWeight: Record<Rarity, number> = {
  Mythic: 6,
  Legendary: 5,
  Epic: 4,
  Rare: 3,
  Uncommon: 2,
  Common: 1
};

const quickFilterLabel: Record<QuickFilter, string> = {
  bestChance: 'Best chance',
  nearUpgrades: 'Near upgrades',
  premiumTargets: 'Premium targets',
  popular: 'Popular'
};

const sortLabel: Record<SortBy, string> = {
  bestChance: 'Best chance',
  highestValue: 'Highest value',
  lowestValue: 'Lowest value',
  rarity: 'Rarity'
};

export default function UpgraderPage() {
  const { inventory, isAuthenticated, openAuthModal } = useGame();
  const [source, setSource] = useState<InventoryItem | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [settings, setSettings] = useState<UpgraderSettings | null>(null);
  const [targets, setTargets] = useState<Item[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('bestChance');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('bestChance');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [nextSettings, nextTargets] = await Promise.all([getUpgraderSettings(), getUpgraderTargets()]);
        setSettings(nextSettings);
        setTargets(
          nextTargets.map((entry) => ({
            id: entry.id,
            name: entry.name,
            imageUrl: entry.imageUrl,
            coinValue: toCoins(Number(entry.coinValue ?? 0), PRICE_UNIT_MODE),
            rarity: rarityMap[String(entry.rarity).toLowerCase()] ?? 'Common',
            category: entry.category || 'General',
            enabled: entry.enabled !== false
          }))
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load upgrader data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const realInventoryItems = useMemo<InventoryItem[]>(() => {
    const allowedIds = settings?.sourceItemIdsEnabled ?? [];
    const hasSourceAllowList = allowedIds.length > 0;

    return inventory
      .filter((item) => (item.status ?? 'available') === 'available')
      .filter((item) => !hasSourceAllowList || allowedIds.includes(String(item.id ?? '')))
      .map((item) => ({
        id: item.instanceId,
        name: item.name,
        imageUrl: item.image,
        coinValue: toCoins(Number(item.price ?? 0), PRICE_UNIT_MODE),
        rarity: rarityMap[item.rarity] ?? 'Common',
        category: item.category || 'General',
        locked: item.locked,
        shipping: item.status === 'shipping' || item.status === 'shipping_requested'
      }));
  }, [inventory, settings?.sourceItemIdsEnabled]);

  const filteredTargets = useMemo(() => {
    if (!settings) return targets;
    const categories = settings.categoriesEnabled ?? [];
    const rarities = settings.raritiesEnabled ?? [];
    return targets.filter((item) => {
      const categoryAllowed = categories.length === 0 || categories.includes(String(item.category ?? ''));
      const rarityAllowed = rarities.length === 0 || rarities.includes(String(item.rarity ?? '').toLowerCase());
      return categoryAllowed && rarityAllowed;
    });
  }, [settings, targets]);

  const targetBoxes = useMemo<TargetBox[]>(() => {
    const grouped = filteredTargets.reduce<Record<string, Item[]>>((acc, item) => {
      const key = item.category || 'General';
      acc[key] = acc[key] ? [...acc[key], item] : [item];
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, items]) => {
        const sortedByValue = [...items].sort((a, b) => b.coinValue - a.coinValue);
        return {
          id: name,
          name,
          imageUrl: sortedByValue[0]?.imageUrl || '',
          items,
          minValue: Math.min(...items.map((item) => item.coinValue)),
          maxValue: Math.max(...items.map((item) => item.coinValue)),
          featured: sortedByValue.slice(0, 3)
        };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [filteredTargets]);

  useEffect(() => {
    if (!targetBoxes.length) {
      setSelectedBoxId('');
      return;
    }

    if (!selectedBoxId || !targetBoxes.some((box) => box.id === selectedBoxId)) {
      setSelectedBoxId(targetBoxes[0].id);
    }
  }, [selectedBoxId, targetBoxes]);

  const selectedBox = useMemo(() => targetBoxes.find((box) => box.id === selectedBoxId) ?? null, [selectedBoxId, targetBoxes]);

  const getChance = (targetItem: Item) => {
    if (!source) return 0;
    if (!settings) {
      const fallbackChance = (source.coinValue / targetItem.coinValue) * 0.95 * 100;
      return Math.min(80, Math.max(0.0001, fallbackChance));
    }

    return (
      computeUpgradeChance({
        sourceValue: source.coinValue,
        targetValue: targetItem.coinValue,
        settings,
        isSameRarity: String(source.rarity).toLowerCase() === String(targetItem.rarity).toLowerCase()
      }) * 100
    );
  };

  const boxItems = selectedBox?.items ?? [];

  const visibleTargetItems = useMemo(() => {
    const base = boxItems.filter((item) => {
      if (!source) return true;

      const ratio = item.coinValue / Math.max(source.coinValue, 1);
      const chance = getChance(item);

      if (quickFilter === 'bestChance') return chance >= 35;
      if (quickFilter === 'nearUpgrades') return ratio >= 1.05 && ratio <= 1.9;
      if (quickFilter === 'premiumTargets') return item.rarity === 'Legendary' || item.rarity === 'Mythic' || ratio > 2.3;
      return chance >= 12 && sortWeight[item.rarity] >= 3;
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'highestValue') return b.coinValue - a.coinValue;
      if (sortBy === 'lowestValue') return a.coinValue - b.coinValue;
      if (sortBy === 'rarity') return sortWeight[b.rarity] - sortWeight[a.rarity] || b.coinValue - a.coinValue;
      return getChance(b) - getChance(a);
    });
  }, [boxItems, quickFilter, sortBy, source]);

  const successChance = useMemo(() => (source && target ? getChance(target) : 0), [source, target]);
  const valueDelta = useMemo(() => (source && target ? target.coinValue - source.coinValue : 0), [source, target]);

  const handleUpgrade = async () => {
    if (!source || !target || !settings?.enabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await attemptUpgrade({
        sourceItemInstanceId: source.id,
        targetItemId: target.id,
        clientSeed: `${Date.now()}`
      });

      if (response.win) {
        toast.success(`Upgrade won! You received ${target.name}.`);
      } else {
        toast.error('Upgrade failed. Better luck on the next roll.');
      }

      setSource(null);
      setTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upgrade failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 text-center space-y-4">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Upgrader</h1>
          <p className="text-sm text-slate-300">Sign in to use your real inventory items in the upgrader.</p>
          <button onClick={() => openAuthModal('login')} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 transition-colors">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060a16] text-slate-100 pb-28 lg:pb-10">
      <div className="mx-auto max-w-[1560px] px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-transparent p-4 sm:p-5">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">Pullz.gg Upgrader</h1>
          <p className="mt-1 text-sm text-slate-300">Select your source item, choose a target box, and lock in the exact item you want to chase.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_340px] lg:gap-6">
          <section id="inventory-panel" className="rounded-2xl border border-white/10 bg-[#0b1222] p-3 sm:p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Source item</h2>
            {source ? (
              <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
                <div className="flex items-center gap-3">
                  <img src={source.imageUrl} alt={source.name} className="h-16 w-16 rounded-lg object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{source.name}</p>
                    <CoinAmount amount={Math.round(source.coinValue)} className="mt-1 text-sm font-bold text-amber-300" iconClassName="h-4 w-4" />
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rarityTone[source.rarity]}`}>{source.rarity}</span>
                  </div>
                </div>
                <button onClick={() => setSource(null)} className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10">
                  Change item
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                Pick an item from your inventory to get started.
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory</h3>
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">{realInventoryItems.length}</span>
            </div>
            <div className="mt-2 grid max-h-[58vh] grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-3 lg:grid-cols-2">
              {realInventoryItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSource(item)}
                  className={`rounded-xl border p-2 text-left transition ${source?.id === item.id ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.16)]' : 'border-white/10 bg-white/[0.02] hover:border-violet-400/40 hover:bg-violet-500/5'}`}
                >
                  <img src={item.imageUrl} alt={item.name} className="mx-auto h-14 w-14 object-cover" referrerPolicy="no-referrer" />
                  <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-100">{item.name}</p>
                  <CoinAmount amount={Math.round(item.coinValue)} className="mt-1 text-[11px] font-semibold text-amber-300" iconClassName="h-3.5 w-3.5" />
                </button>
              ))}
              {!loading && realInventoryItems.length === 0 && <p className="col-span-full rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400">No eligible inventory items found.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0b1222] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Target box</h2>
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">{targetBoxes.length} boxes</span>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar lg:grid lg:grid-cols-2 lg:overflow-visible">
              {targetBoxes.map((box) => (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => {
                    setSelectedBoxId(box.id);
                    setTarget(null);
                  }}
                  className={`min-w-[250px] rounded-xl border p-3 text-left transition lg:min-w-0 ${selectedBoxId === box.id ? 'border-violet-400/65 bg-violet-500/10 shadow-[0_0_28px_rgba(139,92,246,0.16)]' : 'border-white/10 bg-white/[0.02] hover:border-cyan-400/35'}`}
                >
                  <div className="flex items-start gap-3">
                    <img src={box.imageUrl} alt={box.name} className="h-14 w-14 rounded-lg object-cover" referrerPolicy="no-referrer" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{box.name}</p>
                      <p className="text-[11px] text-slate-400">{box.items.length} items</p>
                      <div className="mt-1 text-[11px] text-amber-300">
                        <CoinAmount amount={Math.round(box.minValue)} className="inline text-[11px] font-semibold" iconClassName="h-3 w-3" />
                        <span className="mx-1 text-slate-500">-</span>
                        <CoinAmount amount={Math.round(box.maxValue)} className="inline text-[11px] font-semibold" iconClassName="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex -space-x-2">
                    {box.featured.map((featured) => (
                      <img key={featured.id} src={featured.imageUrl} alt={featured.name} className="h-7 w-7 rounded-full border border-[#0b1222] object-cover" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(Object.keys(quickFilterLabel) as QuickFilter[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setQuickFilter(tab)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${quickFilter === tab ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200' : 'border-white/15 bg-white/[0.03] text-slate-300 hover:border-violet-300/40'}`}
                >
                  {quickFilterLabel[tab]}
                </button>
              ))}

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="ml-auto rounded-lg border border-white/15 bg-[#0f172d] px-3 py-1.5 text-xs font-medium text-slate-100"
              >
                {(Object.keys(sortLabel) as SortBy[]).map((value) => (
                  <option key={value} value={value}>{sortLabel[value]}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target items</h3>
                <span className="text-[11px] text-slate-500">{selectedBox ? selectedBox.name : 'Select a box'}</span>
              </div>

              {!selectedBox && <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-slate-400">Choose a target box first.</div>}

              {selectedBox && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {visibleTargetItems.map((item) => {
                    const itemChance = getChance(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTarget(item)}
                        className={`rounded-xl border p-2 text-left transition ${target?.id === item.id ? 'border-violet-400/70 bg-violet-500/10 shadow-[0_0_28px_rgba(139,92,246,0.2)]' : 'border-white/10 bg-white/[0.02] hover:border-cyan-400/35'}`}
                      >
                        <img src={item.imageUrl} alt={item.name} className="mx-auto h-16 w-16 object-cover" referrerPolicy="no-referrer" />
                        <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-100">{item.name}</p>
                        <CoinAmount amount={Math.round(item.coinValue)} className="mt-1 text-[11px] font-semibold text-amber-300" iconClassName="h-3.5 w-3.5" />
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${rarityTone[item.rarity]}`}>{item.rarity}</span>
                          <span className="text-[10px] font-semibold text-cyan-300">{source ? formatChance(itemChance) : '--'}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!loading && visibleTargetItems.length === 0 && <p className="col-span-full rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">No items match this filter. Try another tab or sort.</p>}
                </div>
              )}
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-5 rounded-2xl border border-white/10 bg-[#0b1222] p-4 shadow-[0_12px_45px_rgba(0,0,0,0.4)]">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Upgrade summary</h2>
              <div className="mt-3 space-y-3">
                <SummaryRow icon={<LucidePackage className="h-4 w-4" />} title="From" item={source} placeholder="Select source item" />
                <SummaryRow icon={<LucideTarget className="h-4 w-4" />} title="To" item={target} placeholder="Select target item" />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <DataLine label="Value increase" value={source && target ? <CoinAmount amount={Math.round(valueDelta)} className={`${valueDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold`} iconClassName="h-4 w-4" /> : '--'} />
                <DataLine label="Success chance" value={source && target ? <span className="font-semibold text-cyan-300">{formatChance(successChance)}</span> : '--'} />
              </div>

              <button
                type="button"
                disabled={!source || !target || !settings?.enabled || isSubmitting}
                onClick={handleUpgrade}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${source && target && settings?.enabled && !isSubmitting ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-95' : 'cursor-not-allowed bg-white/10 text-slate-500'}`}
              >
                {isSubmitting ? 'Upgrading...' : 'Upgrade now'}
              </button>
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090f1f]/95 p-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-[1560px]">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-300">
            <LucideSparkles className="h-3.5 w-3.5 text-cyan-300" />
            <span className="truncate">{target ? target.name : 'Select a target item to continue'}</span>
            {source && target && <span className="ml-auto font-semibold text-cyan-300">{formatChance(successChance)}</span>}
          </div>

          <button
            type="button"
            disabled={!source || !target || !settings?.enabled || isSubmitting}
            onClick={handleUpgrade}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${source && target && settings?.enabled && !isSubmitting ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white' : 'cursor-not-allowed bg-white/10 text-slate-500'}`}
          >
            {isSubmitting ? <LucideLoader2 className="h-4 w-4 animate-spin" /> : <LucideArrowUpRight className="h-4 w-4" />}
            {isSubmitting ? 'Upgrading...' : 'Upgrade now'}
            <LucideChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  title,
  item,
  placeholder
}: {
  icon: React.ReactNode;
  title: string;
  item: Item | InventoryItem | null;
  placeholder: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
        {icon}
        <span>{title}</span>
      </div>
      {item ? (
        <div className="flex items-center gap-3">
          <img src={item.imageUrl} alt={item.name} className="h-11 w-11 rounded-lg object-cover" referrerPolicy="no-referrer" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
            <CoinAmount amount={Math.round(item.coinValue)} className="text-xs font-semibold text-amber-300" iconClassName="h-3.5 w-3.5" />
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{placeholder}</p>
      )}
    </div>
  );
}

function DataLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
