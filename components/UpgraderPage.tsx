import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { attemptUpgrade, getUpgraderSettings, getUpgraderTargets } from '../services/upgraderService';
import { UpgradeResultModal } from './upgrader/UpgradeResultModal';
import { UpgradeSpinWheel } from './upgrader/UpgradeSpinWheel';
import { computeUpgradeChance, getItemCoinValue, UpgraderSettings, UpgraderTarget } from '../utils/upgrader';
import { BoxCard } from './BoxCard';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const waitForNextPaint = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));

const rarityGlow: Record<string, string> = {
  common: 'shadow-[0_0_0_1px_rgba(156,163,175,0.4),0_0_24px_rgba(156,163,175,0.12)]',
  uncommon: 'shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_0_24px_rgba(34,197,94,0.2)]',
  rare: 'shadow-[0_0_0_1px_rgba(59,130,246,0.5),0_0_24px_rgba(59,130,246,0.25)]',
  epic: 'shadow-[0_0_0_1px_rgba(168,85,247,0.5),0_0_24px_rgba(168,85,247,0.24)]',
  legendary: 'shadow-[0_0_0_1px_rgba(251,191,36,0.55),0_0_24px_rgba(251,191,36,0.28)]'
};

const getRiskLabel = (chancePercent: number) => {
  if (chancePercent >= 60) return { label: 'Safe', tone: 'text-emerald-300' };
  if (chancePercent >= 35) return { label: 'Balanced', tone: 'text-cyan-300' };
  return { label: 'High Risk', tone: 'text-rose-300' };
};

const SelectionSummaryCard: React.FC<{
  title: string;
  image?: string;
  name?: string;
  value?: number;
  rarity?: string;
}> = ({ title, image, name, value, rarity }) => (
  <div className={`rounded-xl border border-white/10 bg-[#0c1324] p-3 ${rarityGlow[rarity || ''] || ''}`}>
    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{title}</div>
    <div className="mt-2 flex items-center gap-3">
      {image ? <img src={image} alt={name || title} className="h-11 w-11 rounded-lg object-cover" /> : <div className="h-11 w-11 rounded-lg bg-white/10" />}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{name || 'Not selected'}</div>
        <div className="text-xs font-semibold text-emerald-300">{typeof value === 'number' ? `${value.toLocaleString()} coins` : '—'}</div>
      </div>
    </div>
  </div>
);

export const UpgraderPage: React.FC = () => {
  const { inventory, boxes, isAuthenticated, openAuthModal } = useGame();
  const [settings, setSettings] = useState<UpgraderSettings | null>(null);
  const [targets, setTargets] = useState<UpgraderTarget[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [spinPhase, setSpinPhase] = useState<'idle' | 'settling'>('idle');
  const [wheelRotation, setWheelRotation] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [result, setResult] = useState<null | { win: boolean; roll: number; chance: number; awardedItem?: { name: string; imageUrl: string } }>(null);
  const [filters, setFilters] = useState({ search: '', rarity: '', min: 0, max: 0 });

  useEffect(() => {
    void (async () => {
      setIsLoadingConfig(true);
      try {
        const [nextSettings, nextTargets] = await Promise.all([getUpgraderSettings(), getUpgraderTargets()]);
        setSettings(nextSettings);
        setTargets(nextTargets);
      } finally {
        setIsLoadingConfig(false);
      }
    })();
  }, []);

  const availableInventory = useMemo(
    () => inventory.filter((item) => (item.status ?? 'available') === 'available' && !item.locked),
    [inventory]
  );

  const sourceItem = useMemo(
    () => availableInventory.find((item) => item.instanceId === selectedSourceId),
    [availableInventory, selectedSourceId]
  );

  const targetMap = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets]);

  const availableBoxes = useMemo(() => {
    return boxes.filter((box) => box.items.some((item) => targetMap.has(item.id)));
  }, [boxes, targetMap]);

  const selectedBox = useMemo(
    () => availableBoxes.find((box) => box.id === selectedBoxId) ?? null,
    [availableBoxes, selectedBoxId]
  );

  const boxTargets = useMemo(() => {
    if (!selectedBox) return [];
    const mapped = selectedBox.items
      .map((item) => targetMap.get(item.id))
      .filter((entry): entry is UpgraderTarget => Boolean(entry));

    return mapped
      .filter((target) => {
        if (filters.search && !target.name.toLowerCase().includes(filters.search.toLowerCase().trim())) return false;
        if (filters.rarity && target.rarity !== filters.rarity) return false;
        if (target.coinValue < filters.min) return false;
        if (filters.max > 0 && target.coinValue > filters.max) return false;
        return true;
      })
      .sort((a, b) => a.coinValue - b.coinValue);
  }, [selectedBox, targetMap, filters.search, filters.rarity, filters.min, filters.max]);

  const rarities = useMemo(() => Array.from(new Set(targets.map((target) => target.rarity))).sort(), [targets]);
  const targetItem = useMemo(() => targets.find((target) => target.id === selectedTargetId), [targets, selectedTargetId]);

  useEffect(() => {
    if (!selectedTargetId) return;
    if (!selectedBox || !selectedBox.items.some((item) => item.id === selectedTargetId)) {
      setSelectedTargetId(null);
    }
  }, [selectedBox, selectedTargetId]);

  const chance = useMemo(() => {
    if (!settings || !sourceItem || !targetItem) return 0;
    return computeUpgradeChance({
      sourceValue: getItemCoinValue(sourceItem),
      targetValue: targetItem.coinValue,
      settings,
      isSameRarity: sourceItem.rarity === targetItem.rarity
    });
  }, [settings, sourceItem, targetItem]);

  const chancePercent = chance * 100;
  const risk = getRiskLabel(chancePercent);

  const now = Date.now();
  const isCooldown = now < cooldownUntil;
  const isDisabled = !settings?.enabled || !sourceItem || !targetItem || chance <= 0 || isSubmitting || isCooldown;

  const onAttempt = async () => {
    if (!sourceItem || !targetItem || !settings) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = await attemptUpgrade({
        sourceItemInstanceId: sourceItem.instanceId,
        targetItemId: targetItem.id,
        clientSeed: `${Date.now()}`
      });

      const currentBase = ((wheelRotation % 360) + 360) % 360;
      const settleAngle = currentBase + 1440 + payload.roll * 360;

      setSpinPhase('idle');
      setWheelRotation(currentBase);
      await waitForNextPaint();

      setSpinPhase('settling');
      setWheelRotation(settleAngle);
      await sleep(1750);

      setWheelRotation(((settleAngle % 360) + 360) % 360);
      setSpinPhase('idle');
      setResult(payload);
      setCooldownUntil(Date.now() + settings.cooldownMs);
      setSelectedSourceId(null);
      setSelectedTargetId(null);
    } catch (attemptError) {
      setSpinPhase('idle');
      setError(attemptError instanceof Error ? attemptError.message : 'Failed to upgrade item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="mx-auto max-w-2xl p-6 text-center"><h1 className="text-2xl font-bold text-white">Upgrader</h1><p className="mt-2 text-gray-400">Sign in to use upgrades.</p><button onClick={() => openAuthModal('login')} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Sign in</button></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] p-3 sm:p-6">
      <h1 className="text-2xl font-black text-white sm:text-3xl">Upgrader</h1>
      <p className="mb-4 text-sm text-gray-400">Select an inventory item, pick a box, target an item, then send it.</p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="order-2 space-y-4 xl:order-1">
          <section className="rounded-2xl border border-white/10 bg-[#090f1d] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-white sm:text-lg">Step 1 — Select Your Item</h2>
              <span className="text-xs text-gray-400">{availableInventory.length} available</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:hidden">
              {availableInventory.map((item) => {
                const active = selectedSourceId === item.instanceId;
                return (
                  <button key={item.instanceId} onClick={() => setSelectedSourceId(item.instanceId)} className={`min-w-[180px] rounded-xl border bg-[#0f1728] p-2 text-left transition ${active ? 'border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.25)]' : 'border-white/10'}`}>
                    <img src={item.image} alt={item.name} className="h-24 w-full rounded-lg object-cover" />
                    <div className="mt-2 truncate text-sm font-semibold text-white">{item.name}</div>
                    <div className="text-xs font-semibold text-emerald-300">{getItemCoinValue(item).toLocaleString()} coins</div>
                  </button>
                );
              })}
            </div>
            <div className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
              {availableInventory.map((item) => {
                const active = selectedSourceId === item.instanceId;
                return (
                  <button key={item.instanceId} onClick={() => setSelectedSourceId(item.instanceId)} className={`rounded-xl border bg-[#0f1728] p-2 text-left transition hover:-translate-y-0.5 ${active ? 'border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.25)]' : `border-white/10 ${rarityGlow[item.rarity] || ''}`}`}>
                    <img src={item.image} alt={item.name} className="h-24 w-full rounded-lg object-cover" />
                    <div className="mt-2 truncate text-sm font-semibold text-white">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.rarity}</div>
                    <div className="text-xs font-semibold text-emerald-300">{getItemCoinValue(item).toLocaleString()} coins</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#090f1d] p-3 sm:p-4">
            <h2 className="mb-3 text-base font-extrabold text-white sm:text-lg">Step 2 — Choose Target Box</h2>
            {isLoadingConfig ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2 sm:hidden">
                  {availableBoxes.map((box) => (
                    <div key={box.id} className={`min-w-[220px] rounded-2xl transition ${selectedBoxId === box.id ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[#090f1d]' : ''}`}>
                      <BoxCard box={box} onSelect={setSelectedBoxId} size="compact" />
                    </div>
                  ))}
                </div>
                <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                  {availableBoxes.map((box) => (
                    <div key={box.id} className={`rounded-2xl transition ${selectedBoxId === box.id ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[#090f1d]' : ''}`}>
                      <BoxCard box={box} onSelect={setSelectedBoxId} size="compact" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#090f1d] p-3 sm:p-4">
            <h2 className="mb-3 text-base font-extrabold text-white sm:text-lg">Step 3 — Select Target Item</h2>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <label className="col-span-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:col-span-1">
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Search"
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
              <select value={filters.rarity} onChange={(event) => setFilters((prev) => ({ ...prev, rarity: event.target.value }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-white">
                <option value="">All rarities</option>
                {rarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
              </select>
              <input type="number" placeholder="Min" value={filters.min || ''} onChange={(event) => setFilters((prev) => ({ ...prev, min: Number(event.target.value || 0) }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-white" />
              <input type="number" placeholder="Max" value={filters.max || ''} onChange={(event) => setFilters((prev) => ({ ...prev, max: Number(event.target.value || 0) }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-white" />
            </div>

            {!selectedBox ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-gray-400">Pick a target box to load its available upgrader items.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {boxTargets.map((target) => {
                  const active = selectedTargetId === target.id;
                  return (
                    <button
                      key={target.id}
                      onClick={() => setSelectedTargetId(target.id)}
                      className={`group rounded-xl border bg-[#0f1728] p-2 text-left transition hover:-translate-y-0.5 ${active ? 'border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.25)]' : `border-white/10 ${rarityGlow[target.rarity] || ''}`}`}
                      title={`${target.name} · ${target.coinValue.toLocaleString()} coins`}
                    >
                      <img src={target.imageUrl} alt={target.name} loading="lazy" className="h-20 w-full rounded-lg object-cover" />
                      <div className="mt-2 line-clamp-1 text-xs font-semibold text-white sm:text-sm">{target.name}</div>
                      <div className="text-[11px] text-gray-400">{target.rarity}</div>
                      <div className="text-xs font-semibold text-cyan-300">{target.coinValue.toLocaleString()} coins</div>
                    </button>
                  );
                })}
                {boxTargets.length === 0 && <div className="col-span-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">No items match your filter.</div>}
              </div>
            )}
          </section>
        </div>

        <aside className="order-1 xl:order-2">
          <div className="sticky top-[74px] space-y-3 rounded-2xl border border-white/10 bg-[#090f1d]/95 p-3 backdrop-blur sm:p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <SelectionSummaryCard title="Your Item" image={sourceItem?.image} name={sourceItem?.name} value={sourceItem ? getItemCoinValue(sourceItem) : undefined} rarity={sourceItem?.rarity} />
              <div className="text-center text-lg font-black text-cyan-300">→</div>
              <SelectionSummaryCard title="Target Item" image={targetItem?.imageUrl} name={targetItem?.name} value={targetItem?.coinValue} rarity={targetItem?.rarity} />
            </div>

            <UpgradeSpinWheel chance={chance} phase={spinPhase} rotationDeg={wheelRotation} target={targetItem} />

            <div className="rounded-xl border border-white/10 bg-[#0f1728] p-3">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
                <span>Upgrade Chance Slider</span>
                <span className="font-bold text-emerald-300">{chancePercent.toFixed(2)}%</span>
              </div>
              <input type="range" min={0} max={100} value={Math.max(0, Math.min(100, chancePercent))} readOnly className="h-2 w-full accent-cyan-400" />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">Success %: <span className="font-semibold text-white">{chancePercent.toFixed(2)}%</span></span>
                <span className={`font-semibold ${risk.tone}`}>Risk: {risk.label}</span>
              </div>
            </div>

            <button disabled={isDisabled} onClick={onAttempt} title={isCooldown ? 'Cooldown active' : ''} className="sticky bottom-2 h-14 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-cyan-500 to-emerald-500 px-4 text-base font-black text-white shadow-[0_12px_30px_rgba(34,211,238,0.32)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg">
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Calculating result…</span>
              ) : (
                <span>
                  Upgrade Now · {chancePercent.toFixed(2)}% · {targetItem && sourceItem ? `${(targetItem.coinValue / Math.max(1, getItemCoinValue(sourceItem))).toFixed(2)}x` : '—'}
                </span>
              )}
            </button>
          </div>
        </aside>
      </div>

      {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</div>}
      <UpgradeResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
};
