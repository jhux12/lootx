import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LucideArrowRight,
  LucideHistory,
  LucideInfo,
  LucideSearch,
  LucideZap,
  LucideChevronLeft,
  LucideChevronRight,
  LucideVolume2,
  LucideVolumeX
} from 'lucide-react';
import { InventoryItem, Item, Rarity } from '../components/upgrader/upgraderTypes';
import { useGame } from '../../context/GameContext';
import { attemptUpgrade, getUpgraderSettings, getUpgraderTargets } from '../../services/upgraderService';
import { computeUpgradeChance, UpgraderSettings } from '../../utils/upgrader';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { CoinAmount } from '../../components/CoinAmount';
import { ItemCard } from '../../components/upgrader-elite/ItemCard';
import { UpgraderSpinner } from '../../components/upgrader-elite/UpgraderSpinner';
import { Item as EliteItem, UpgradeStatus } from '../../components/upgrader-elite/types';
import { BoxCard } from '../../components/BoxCard';
import upgraderSoundUrl from '../../assets/upgrader.mp3';
import { toast } from '../ui/toast/toast';

const rarityMap: Record<string, Rarity> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic'
};

const normalizeEliteRarity = (rarity?: string): EliteItem['rarity'] => {
  const value = String(rarity ?? '').toLowerCase();
  if (value === 'uncommon' || value === 'rare' || value === 'epic' || value === 'legendary' || value === 'mythic') {
    return value;
  }
  return 'common';
};

const mapToEliteItem = (item: Partial<Item & InventoryItem> & { imageUrl?: string; coinValue?: number; image?: string }): EliteItem => ({
  id: String(item.id ?? ''),
  name: String(item.name ?? 'Unknown'),
  price: Number(item.coinValue ?? 0),
  image: String(item.image ?? item.imageUrl ?? ''),
  rarity: normalizeEliteRarity(String(item.rarity ?? 'common'))
});

const SPIN_DURATION_MS = 5200;

export default function UpgraderPage() {
  const { inventory, boxes, isAuthenticated, openAuthModal } = useGame();
  const [source, setSource] = useState<InventoryItem | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<UpgraderSettings | null>(null);
  const [targets, setTargets] = useState<Item[]>([]);
  const [status, setStatus] = useState<UpgradeStatus>('idle');
  const [spinRotation, setSpinRotation] = useState(0);
  const [winZoneRotation, setWinZoneRotation] = useState(0);
  const [spinNonce, setSpinNonce] = useState(0);
  const [spinResult, setSpinResult] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Array<{ item: EliteItem; success: boolean; date: number }>>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [targetFilters, setTargetFilters] = useState({ search: '', rarity: '', min: 0, max: 0 });
  const [detailsItem, setDetailsItem] = useState<EliteItem | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const idleTimeoutRef = useRef<number | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedSpinNonceRef = useRef<number>(0);
  const [spinnerSize, setSpinnerSize] = useState<number>(290);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('upgrader-audio-muted') === '1';
  });

  const [reducedMotion, setReducedMotion] = useState(false);
  const [resultSheet, setResultSheet] = useState<{ item: EliteItem; success: boolean } | null>(null);

  useEffect(() => {
    const audio = new Audio(upgraderSoundUrl);
    audio.preload = 'auto';
    audio.volume = 0.45;
    spinAudioRef.current = audio;

    return () => {
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current.currentTime = 0;
      }
      spinAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('upgrader-audio-muted', isMuted ? '1' : '0');
  }, [isMuted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const audio = spinAudioRef.current;
    if (!audio || isMuted) return;
    if (status !== 'spinning' || spinNonce <= 0) return;
    if (lastPlayedSpinNonceRef.current === spinNonce) return;

    lastPlayedSpinNonceRef.current = spinNonce;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [isMuted, spinNonce, status]);

  useEffect(() => {
    if (!isMuted) return;
    const audio = spinAudioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }, [isMuted]);

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
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : 'Failed to load upgrader data.');
      } finally {
        setLoading(false);
      }
    })();

    const handleResize = () => setSpinnerSize(window.innerWidth < 640 ? 230 : 290);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
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

  const settingsFilteredTargets = useMemo(() => {
    if (!settings) return targets;
    const categories = settings.categoriesEnabled ?? [];
    const rarities = settings.raritiesEnabled ?? [];
    return targets.filter((item) => {
      const normalizedCategory = String(item.category ?? '');
      const normalizedRarity = String(item.rarity ?? '').toLowerCase();
      const categoryAllowed = categories.length === 0 || categories.includes(normalizedCategory);
      const rarityAllowed = rarities.length === 0 || rarities.includes(normalizedRarity);
      return categoryAllowed && rarityAllowed;
    });
  }, [settings, targets]);

  const targetIdSet = useMemo(() => new Set(settingsFilteredTargets.map((item) => item.id)), [settingsFilteredTargets]);
  const availableBoxes = useMemo(
    () => boxes.filter((box) => box.items.some((item) => targetIdSet.has(item.id))),
    [boxes, targetIdSet]
  );

  useEffect(() => {
    if (selectedBoxId && !availableBoxes.some((box) => box.id === selectedBoxId)) {
      setSelectedBoxId(null);
      setTarget(null);
    }
  }, [availableBoxes, selectedBoxId, setTarget]);

  const selectedBox = useMemo(
    () => availableBoxes.find((box) => box.id === selectedBoxId) ?? null,
    [availableBoxes, selectedBoxId]
  );

  const filteredTargets = useMemo(() => {
    const inBox = !selectedBox
      ? []
      : settingsFilteredTargets
          .filter((item) => selectedBox.items.some((entry) => entry.id === item.id))
          .filter((item) => {
            if (targetFilters.search && !item.name.toLowerCase().includes(targetFilters.search.toLowerCase().trim())) return false;
            if (targetFilters.rarity && String(item.rarity).toLowerCase() !== targetFilters.rarity) return false;
            if (item.coinValue < targetFilters.min) return false;
            if (targetFilters.max > 0 && item.coinValue > targetFilters.max) return false;
            return true;
          })
          .sort((a, b) => a.coinValue - b.coinValue);
    return inBox;
  }, [selectedBox, settingsFilteredTargets, targetFilters.search, targetFilters.rarity, targetFilters.min, targetFilters.max]);

  const availableRarities = useMemo(
    () => Array.from(new Set(settingsFilteredTargets.map((item) => String(item.rarity).toLowerCase()))).sort(),
    [settingsFilteredTargets]
  );

  const chance = useMemo(() => {
    if (!source || !target) return 0;
    if (!settings) {
      const fallbackChance = (source.coinValue / target.coinValue) * 0.95 * 100;
      return Math.min(80, Math.max(0.0001, fallbackChance));
    }
    return computeUpgradeChance({
      sourceValue: source.coinValue,
      targetValue: target.coinValue,
      settings,
      isSameRarity: String(source.rarity).toLowerCase() === String(target.rarity).toLowerCase()
    }) * 100;
  }, [settings, source, target]);
  const reactorGlowRgb = useMemo(() => {
    if (chance < 30) return '190, 50, 70';
    if (chance < 60) return '217, 119, 6';
    return '16, 185, 129';
  }, [chance]);
  const riskLabel = useMemo(() => {
    if (chance >= 60) return { text: 'Safe', className: 'text-emerald-300' };
    if (chance >= 35) return { text: 'Balanced', className: 'text-cyan-300' };
    return { text: 'High Risk', className: 'text-rose-300' };
  }, [chance]);

  const inventoryItems = useMemo(() => realInventoryItems.map((item) => mapToEliteItem(item)), [realInventoryItems]);
  const targetItems = useMemo(() => filteredTargets.map((item) => mapToEliteItem(item)), [filteredTargets]);

  useEffect(() => {
    if (!target || !selectedBox) return;
    const stillInBox = selectedBox.items.some((item) => item.id === target.id);
    if (!stillInBox) {
      setTarget(null);
    }
  }, [selectedBox, target]);

  const sourcePreview = source ? mapToEliteItem(source) : null;
  const targetPreview = target ? mapToEliteItem(target) : null;

  const computeSpinDelta = (baseChance: number, success: boolean, currentRotation: number, zoneRotation: number) => {
    const clampedChance = Math.max(0.0001, Math.min(99.9999, baseChance));
    const successSpan = (clampedChance / 100) * 360;
    const minPad = 8;
    const normalizedZoneRotation = ((zoneRotation % 360) + 360) % 360;
    let desiredZoneAngle = 0;

    if (success) {
      const maxAngle = Math.max(minPad + 1, successSpan - minPad);
      const successStart = normalizedZoneRotation;
      desiredZoneAngle = successStart + minPad + Math.random() * (maxAngle - minPad);
    } else {
      const failStart = normalizedZoneRotation + successSpan + minPad;
      const failSpan = 360 - successSpan - minPad * 2;
      desiredZoneAngle = failStart + Math.random() * Math.max(1, failSpan);
    }

    const currentModulo = ((currentRotation % 360) + 360) % 360;
    const normalizedDesired = ((desiredZoneAngle % 360) + 360) % 360;
    const moduloDelta = (normalizedDesired - currentModulo + 360) % 360;
    return 8 * 360 + moduloDelta;
  };

  useEffect(() => {
    if (!source || !target) {
      setWinZoneRotation(0);
    }
  }, [source, target]);

  const handleUpgrade = async () => {
    if (!source || !target || !settings || isSubmitting || status === 'spinning') return;

    setIsSubmitting(true);
    setStatus('spinning');

    if (!isMuted && spinAudioRef.current) {
      lastPlayedSpinNonceRef.current = spinNonce + 1;
      spinAudioRef.current.currentTime = 0;
      void spinAudioRef.current.play().catch(() => undefined);
    }

    try {
      const response = await attemptUpgrade({
        sourceItemInstanceId: source.id,
        targetItemId: target.id,
        clientSeed: `${Date.now()}`
      });

      const success = Boolean(response.win);
      setSpinResult(success);
      setSpinRotation((previous) => previous + computeSpinDelta(chance, success, previous, winZoneRotation));
      setSpinNonce((previous) => previous + 1);
    } catch (attemptError) {
      setStatus('idle');
      toast.error(attemptError instanceof Error ? attemptError.message : 'Upgrade failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSpinComplete = (success: boolean) => {
    setStatus(success ? 'success' : 'fail');

    const historyItem = success ? targetPreview : sourcePreview;
    if (historyItem) {
      setHistory((previous) => [{ item: historyItem, success, date: Date.now() }, ...previous].slice(0, 20));
      setResultSheet({ item: historyItem, success });
    }

    setSource(null);
    setTarget(null);
    setSpinResult(null);

    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      setStatus('idle');
    }, 1200);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 text-center space-y-4">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Upgrader</h1>
          <p className="text-sm text-slate-300">Sign in to use your real inventory items in the upgrader.</p>
          <button
            onClick={() => openAuthModal('login')}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-200 font-sans selection:bg-violet-500/30 pb-44 lg:pb-32">
      <header className="h-16 border-b border-white/10 bg-[#0a1020]/85 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            <LucideZap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter text-white">Upgrader</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMuted((previous) => !previous)}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition flex items-center justify-center"
            aria-label={isMuted ? 'Unmute upgrader sound' : 'Mute upgrader sound'}
            title={isMuted ? 'Unmute upgrader sound' : 'Mute upgrader sound'}
          >
            {isMuted ? <LucideVolumeX className="w-5 h-5" /> : <LucideVolume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition flex items-center justify-center text-base font-black"
            aria-label="How the upgrader works"
            title="How the upgrader works"
          >
            ?
          </button>
          <LucideHistory className="w-5 h-5 text-slate-400" />
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-4 lg:gap-8 p-3 sm:p-4 lg:p-8">
        <section className="order-2 xl:order-1 space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Step 1 — Select Your Item</h2>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{inventoryItems.length}</span>
            </div>
            <div className="grid grid-flow-col auto-cols-[48%] gap-3 overflow-x-auto pb-1 sm:hidden">
              {inventoryItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isSelected={source?.id === item.id}
                  onInfoClick={setDetailsItem}
                  onClick={() => {
                    const match = realInventoryItems.find((entry) => entry.id === item.id) ?? null;
                    setSource(match);
                  }}
                  disabled={status === 'spinning' || loading}
                />
              ))}
            </div>
            <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {inventoryItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isSelected={source?.id === item.id}
                  onInfoClick={setDetailsItem}
                  onClick={() => {
                    const match = realInventoryItems.find((entry) => entry.id === item.id) ?? null;
                    setSource(match);
                  }}
                  disabled={status === 'spinning' || loading}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Step 2 — Choose Target Box</h2>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{availableBoxes.length}</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto pb-2 sm:hidden">
                  {availableBoxes.map((box) => (
                    <div key={box.id} className={`rounded-2xl transition ${selectedBoxId === box.id ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[#050811]' : ''}`}>
                      <BoxCard box={box} onSelect={setSelectedBoxId} size="compact" />
                    </div>
                  ))}
                </div>
                <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableBoxes.map((box) => (
                    <div key={box.id} className={`rounded-2xl transition ${selectedBoxId === box.id ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[#050811]' : ''}`}>
                      <BoxCard box={box} onSelect={setSelectedBoxId} size="compact" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Step 3 — Select Target Item</h2>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{targetItems.length}</span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs">
                <LucideSearch className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={targetFilters.search}
                  onChange={(event) => setTargetFilters((previous) => ({ ...previous, search: event.target.value }))}
                  placeholder="Search"
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
              <select
                value={targetFilters.rarity}
                onChange={(event) => setTargetFilters((previous) => ({ ...previous, rarity: event.target.value }))}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
              >
                <option value="">All rarities</option>
                {availableRarities.map((rarity) => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
              <input
                type="number"
                value={targetFilters.min || ''}
                onChange={(event) => setTargetFilters((previous) => ({ ...previous, min: Number(event.target.value || 0) }))}
                placeholder="Min"
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
              />
              <input
                type="number"
                value={targetFilters.max || ''}
                onChange={(event) => setTargetFilters((previous) => ({ ...previous, max: Number(event.target.value || 0) }))}
                placeholder="Max"
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
              />
            </div>

            {!selectedBox ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-4 text-sm text-slate-400">Select a target box to load its items.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar transition-all duration-300">
                {targetItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isSelected={target?.id === item.id}
                    onInfoClick={setDetailsItem}
                    onClick={() => {
                      const match = filteredTargets.find((entry) => entry.id === item.id) ?? null;
                      setTarget(match);
                    }}
                    disabled={status === 'spinning' || loading}
                  />
                ))}
                {targetItems.length === 0 && (
                  <div className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No target items match your filters.</div>
                )}
              </div>
            )}
          </section>
        </section>

        <section
          className="order-1 xl:order-2 reactor-stage rounded-[24px] border border-violet-400/10 bg-white/[0.02] p-4 sm:p-6 xl:sticky xl:top-20 h-fit"
          style={{ ['--reactor-glow-rgb' as string]: reactorGlowRgb }}
        >
          <div className="relative z-10 w-full flex flex-col items-center">
            <div className="mb-4 w-full rounded-2xl border border-white/10 bg-[#0f1524]/70 p-3 sm:mb-6">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Selected Upgrade</div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className={`rounded-xl border p-2 ${sourcePreview ? 'border-violet-400/40 bg-violet-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2">
                    {sourcePreview ? <img src={sourcePreview.image} alt={sourcePreview.name} className="h-10 w-10 rounded-lg object-cover" /> : <LucideChevronLeft className="text-white/20" />}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{sourcePreview?.name || 'Your Item'}</p>
                      <CoinAmount amount={Math.round(sourcePreview?.price ?? 0)} className="text-[10px] font-semibold text-emerald-300" iconClassName="h-3 w-3" />
                    </div>
                  </div>
                </div>
                <LucideArrowRight className={`h-4 w-4 ${sourcePreview && targetPreview ? 'text-violet-300' : 'text-white/20'}`} />
                <div className={`rounded-xl border p-2 ${targetPreview ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2">
                    {targetPreview ? <img src={targetPreview.image} alt={targetPreview.name} className="h-10 w-10 rounded-lg object-cover" /> : <LucideChevronRight className="text-white/20" />}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{targetPreview?.name || 'Target Item'}</p>
                      <CoinAmount amount={Math.round(targetPreview?.price ?? 0)} className="text-[10px] font-semibold text-cyan-300" iconClassName="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <UpgraderSpinner
              chance={chance}
              status={status}
              spinRotation={spinRotation}
              spinNonce={spinNonce}
              spinSuccess={spinResult}
              onSpinComplete={handleSpinComplete}
              winZoneRotation={winZoneRotation}
              onWinZoneRotationChange={setWinZoneRotation}
              canRotateWinZone={Boolean(source && target && status === 'idle')}
              reducedMotion={reducedMotion}
              size={spinnerSize}
              durationMs={SPIN_DURATION_MS}
            />

            <div className="mt-4 w-full rounded-xl border border-white/10 bg-[#0d1322] p-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                <span>Upgrade Chance Slider</span>
                <span className="font-bold text-emerald-300">{chance.toFixed(2)}%</span>
              </div>
              <input type="range" min={0} max={100} value={Math.max(0, Math.min(100, chance))} readOnly className="mt-2 h-2 w-full accent-cyan-400" />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-300">Success %: <span className="font-semibold text-white">{chance.toFixed(2)}%</span></span>
                <span className={`font-semibold ${riskLabel.className}`}>Risk: {riskLabel.text}</span>
              </div>
            </div>

            <div className="mt-4 w-full">
              <button
                onClick={handleUpgrade}
                disabled={status !== 'idle' || !source || !target || !settings?.enabled || isSubmitting}
                className={`reactor-upgrade-btn w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base uppercase tracking-widest transition-all duration-300 ${status === 'idle' && source && target && settings?.enabled ? 'reactor-upgrade-btn-idle bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
              >
                {status === 'spinning'
                  ? 'Upgrading...'
                  : `Upgrade Now · ${chance.toFixed(2)}% · ${source && target ? `${(target.coinValue / Math.max(source.coinValue, 1)).toFixed(2)}x` : '—'}`}
              </button>

              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                <LucideInfo className="w-3 h-3" />
                <span>Provably Fair System</span>
              </div>
            </div>
          </div>
        </section>
      </main>


      <div
        className={`fixed inset-0 z-[72] bg-black/65 backdrop-blur-sm transition-opacity duration-300 ${resultSheet ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setResultSheet(null)}
      />
      <div className={`fixed inset-x-0 bottom-0 z-[73] transform transition-transform duration-300 ${resultSheet ? 'translate-y-0' : 'translate-y-full'} px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-4 sm:pb-4`}>
        {resultSheet && (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1524] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`text-sm font-bold uppercase tracking-widest ${resultSheet.success ? 'text-emerald-300' : 'text-rose-300'}`}>
                {resultSheet.success ? 'Upgrade Success' : 'Upgrade Failed'}
              </h2>
              <button
                type="button"
                onClick={() => setResultSheet(null)}
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <img
                src={resultSheet.item.image}
                alt={resultSheet.item.name}
                className="mx-auto h-28 w-28 rounded-xl object-cover sm:h-32 sm:w-32"
                referrerPolicy="no-referrer"
              />
              <p className="mt-3 text-base font-semibold text-white">{resultSheet.item.name}</p>
              <div className="mt-2 flex justify-center">
                <CoinAmount amount={Math.round(resultSheet.item.price)} className="text-sm font-bold text-amber-300" iconClassName="h-4 w-4" />
              </div>
            </div>
          </div>
        )}
      </div>

      {detailsItem && (
        <>
          <button
            type="button"
            aria-label="Close item details"
            className="fixed inset-0 z-[70] bg-black/65"
            onClick={() => setDetailsItem(null)}
          />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[71] flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-4 sm:pb-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrader-item-details-title"
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1524] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] animate-[upgraderSheetIn_220ms_ease-out] sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 id="upgrader-item-details-title" className="text-sm font-bold uppercase tracking-widest text-slate-300">Item Details</h2>
                <button
                  type="button"
                  onClick={() => setDetailsItem(null)}
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <img
                  src={detailsItem.image}
                  alt={detailsItem.name}
                  className="mx-auto h-28 w-28 rounded-xl object-cover sm:h-32 sm:w-32"
                  referrerPolicy="no-referrer"
                />
                <p className="mt-4 text-center text-base font-semibold text-white">{detailsItem.name}</p>
                <div className="mt-2 flex justify-center">
                  <CoinAmount amount={Math.round(detailsItem.price)} className="text-sm font-bold text-amber-300" iconClassName="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isHelpOpen && (
        <>
          <button
            type="button"
            aria-label="Close upgrader help"
            className="fixed inset-0 z-[70] bg-black/65"
            onClick={() => setIsHelpOpen(false)}
          />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[71] flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-4 sm:pb-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrader-help-title"
              className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#0f1524] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] animate-[upgraderSheetIn_220ms_ease-out] sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="upgrader-help-title" className="text-sm font-bold uppercase tracking-widest text-slate-300">How the Upgrader Works</h2>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
                <p className="text-slate-300">The Upgrader lets you risk one item for a chance at a higher-value item.</p>
                <div>
                  <p className="font-semibold text-white">1. Select Your Item</p>
                  <p className="text-slate-300">Choose an item from your inventory to use for the upgrade.</p>
                </div>
                <div>
                  <p className="font-semibold text-white">2. Choose a Target</p>
                  <p className="text-slate-300">Pick the item you want to upgrade to. Your win chance adjusts automatically based on value difference.</p>
                </div>
                <div>
                  <p className="font-semibold text-white">3. Upgrade</p>
                  <p className="text-slate-300">Click Upgrade and the spinner will determine the result.</p>
                </div>
                <div className="space-y-1 text-slate-300">
                  <p><span className="font-semibold text-emerald-300">Win:</span> You receive the upgraded item.</p>
                  <p><span className="font-semibold text-rose-300">Loss:</span> Your selected item is removed.</p>
                </div>
                <div>
                  <p className="text-slate-300">Your odds are calculated based on:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300">
                    <li>The value of your item</li>
                    <li>The value of the target item</li>
                    <li>The platform edge</li>
                  </ul>
                </div>
                <p className="font-semibold text-violet-300">Upgrade smart. Higher risk means higher reward.</p>
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="fixed bottom-[calc(env(safe-area-inset-bottom)+62px)] lg:bottom-0 left-0 w-full h-20 bg-[#080b10]/90 backdrop-blur-md border-t border-white/10 px-3 lg:px-8 flex items-center gap-3 overflow-x-auto custom-scrollbar z-50">
        <div className="flex items-center gap-2 shrink-0 border-r border-white/10 pr-3">
          <LucideHistory className="w-4 h-4 text-slate-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live Feed</span>
        </div>
        {history.map((entry) => (
          <div key={entry.date} className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 ${entry.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
            <img src={entry.item.image} alt={entry.item.name} className="w-8 h-8 rounded-lg object-cover" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white truncate w-24">{entry.item.name}</span>
              <span className={`text-[9px] font-bold uppercase ${entry.success ? 'text-emerald-400' : 'text-rose-400'}`}>{entry.success ? 'Upgrade Success' : 'Upgrade Failed'}</span>
            </div>
          </div>
        ))}
        {history.length === 0 && <p className="text-xs text-slate-600 italic">No recent activity</p>}
      </footer>

      <style>{`
        @keyframes upgraderSheetIn {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reactorIdlePulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.72;
            box-shadow:
              0 0 0 1px rgba(var(--reactor-glow-rgb), 0.18),
              0 0 18px rgba(var(--reactor-glow-rgb), 0.18),
              0 0 34px rgba(var(--reactor-glow-rgb), 0.08);
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
            box-shadow:
              0 0 0 1px rgba(var(--reactor-glow-rgb), 0.24),
              0 0 24px rgba(var(--reactor-glow-rgb), 0.24),
              0 0 40px rgba(var(--reactor-glow-rgb), 0.12);
          }
        }

        @keyframes rotateEnergy {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes reactorBorderShimmer {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        @keyframes reactorFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-1px);
          }
        }

        .reactor-spinner::before {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          pointer-events: none;
          opacity: 0;
          transform: scale(1);
        }

        .reactor-spinner.spinner-idle::before {
          animation: reactorIdlePulse 3.6s ease-in-out infinite;
        }

        .reactor-energy-layer {
          opacity: 0.2;
          mix-blend-mode: screen;
          background: conic-gradient(
            from 0deg,
            rgba(var(--reactor-glow-rgb), 0.14) 0deg,
            rgba(255, 255, 255, 0) 90deg,
            rgba(var(--reactor-glow-rgb), 0.08) 200deg,
            rgba(255, 255, 255, 0) 320deg,
            rgba(var(--reactor-glow-rgb), 0.12) 360deg
          );
          animation: rotateEnergy 14s linear infinite;
        }

        .reactor-spinner.reactor-flicker {
          filter: brightness(1.06);
        }

        .reactor-spinner.reactor-flicker::before {
          opacity: 1;
          box-shadow:
            0 0 0 1px rgba(var(--reactor-glow-rgb), 0.28),
            0 0 28px rgba(var(--reactor-glow-rgb), 0.28),
            0 0 46px rgba(var(--reactor-glow-rgb), 0.16);
        }

        .reactor-upgrade-btn {
          position: relative;
          overflow: hidden;
        }

        .reactor-upgrade-btn-idle {
          border: 1px solid rgba(var(--reactor-glow-rgb), 0.45);
          background-image:
            linear-gradient(110deg, rgba(76, 29, 149, 0.95), rgba(6, 182, 212, 0.9)),
            linear-gradient(120deg, rgba(var(--reactor-glow-rgb), 0.14), rgba(255, 255, 255, 0.06), rgba(var(--reactor-glow-rgb), 0.14));
          background-origin: border-box;
          background-clip: padding-box, border-box;
          background-size: 100% 100%, 220% 100%;
          animation:
            reactorBorderShimmer 7s ease-in-out infinite,
            reactorFloat 5s ease-in-out infinite;
        }

        .reactor-upgrade-btn-idle:hover {
          box-shadow:
            0 0 18px rgba(var(--reactor-glow-rgb), 0.28),
            0 0 34px rgba(var(--reactor-glow-rgb), 0.18);
        }

        .reactor-needle {
          position: relative;
        }

        .reactor-needle::after {
          content: '';
          position: absolute;
          top: 8px;
          left: 50%;
          width: 30px;
          height: 8px;
          transform: translateX(-50%);
          opacity: 0;
          filter: blur(7px);
          background: linear-gradient(90deg, rgba(255,255,255,0), var(--reactor-risk-color), rgba(255,255,255,0));
          transition: opacity 200ms ease;
        }

        .reactor-needle-trailing::after {
          opacity: 0.72;
        }

        .reactor-needle-ghost {
          opacity: 0;
          transition: opacity 180ms ease;
        }

        .reactor-needle-ghost-active {
          opacity: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .reactor-spinner.spinner-idle::before,
          .reactor-energy-layer {
            animation: none !important;
          }

          .reactor-needle::after,
          .reactor-needle-ghost {
            display: none;
          }
        }

        @media (max-width: 639px) {
          .reactor-spinner::before {
            inset: -4px;
          }

          .reactor-energy-layer {
            opacity: 0.17;
          }
        }
      `}</style>
    </div>
  );
}
