import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LucideArrowRight,
  LucideHistory,
  LucideInfo,
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

const normalizeKey = (value: string) => value.trim().toLowerCase();

const SPIN_DURATION_MS = 5200;

export default function UpgraderPage() {
  const { inventory, boxes, isAuthenticated, openAuthModal } = useGame();
  const [source, setSource] = useState<InventoryItem | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [selectedTargetBoxId, setSelectedTargetBoxId] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<'inventory' | 'targets'>('inventory');
  const [targetSelectionStep, setTargetSelectionStep] = useState<'boxes' | 'items'>('boxes');
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

  const filteredTargets = useMemo(() => {
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

  const activeMysteryBoxes = useMemo(() => {
    return boxes
      .filter((box) => {
        const isSystemMysteryBox = !box.isUserCreated;
        const isNotFreeBox = !box.isDaily;
        const isCoinBox = !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0);
        const isBoxActive = (box as { active?: boolean }).active !== false;
        return isSystemMysteryBox && isNotFreeBox && isCoinBox && isBoxActive && Array.isArray(box.items) && box.items.length > 0;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [boxes]);

  const selectableTargetBoxes = useMemo(() => activeMysteryBoxes, [activeMysteryBoxes]);
  const targetById = useMemo(() => {
    const map = new Map<string, Item>();
    filteredTargets.forEach((entry) => map.set(String(entry.id), entry));
    return map;
  }, [filteredTargets]);
  const targetByName = useMemo(() => {
    const map = new Map<string, Item>();
    filteredTargets.forEach((entry) => {
      const key = normalizeKey(String(entry.name ?? ''));
      if (key && !map.has(key)) map.set(key, entry);
    });
    return map;
  }, [filteredTargets]);

  const selectedTargetBox = useMemo(
    () => selectableTargetBoxes.find((box) => box.id === selectedTargetBoxId) ?? null,
    [selectableTargetBoxes, selectedTargetBoxId]
  );

  const itemsForSelectedBox = useMemo<Item[]>(() => {
    if (!selectedTargetBox) return [];
    return selectedTargetBox.items.map((entry) => ({
      ...(targetById.get(String(entry.id)) ?? targetByName.get(normalizeKey(String(entry.name ?? '')))),
      id: String((targetById.get(String(entry.id)) ?? targetByName.get(normalizeKey(String(entry.name ?? ''))))?.id ?? entry.id ?? ''),
      name: String(entry.name ?? 'Unknown Item'),
      imageUrl: String(entry.image ?? ''),
      coinValue: toCoins(Number(entry.price ?? 0), PRICE_UNIT_MODE),
      rarity: rarityMap[String(entry.rarity).toLowerCase()] ?? 'Common',
      category: String(entry.category ?? 'General'),
      enabled: Boolean(targetById.get(String(entry.id)) ?? targetByName.get(normalizeKey(String(entry.name ?? ''))))
    }));
  }, [selectedTargetBox, targetById, targetByName]);

  const validTargetItemIds = useMemo(
    () => new Set(itemsForSelectedBox.filter((entry) => entry.enabled !== false).map((entry) => String(entry.id))),
    [itemsForSelectedBox]
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

  const inventoryItems = useMemo(() => realInventoryItems.map((item) => mapToEliteItem(item)), [realInventoryItems]);
  const targetItems = useMemo(() => itemsForSelectedBox.map((item) => mapToEliteItem(item)), [itemsForSelectedBox]);

  useEffect(() => {
    if (!selectedTargetBoxId) return;
    const exists = selectableTargetBoxes.some((box) => box.id === selectedTargetBoxId);
    if (!exists) {
      setSelectedTargetBoxId(null);
      setTarget(null);
      setTargetSelectionStep('boxes');
    }
  }, [selectableTargetBoxes, selectedTargetBoxId]);

  useEffect(() => {
    if (!target || !selectedTargetBox) return;
    const existsInSelectedBox = selectedTargetBox.items.some((entry) => String(entry.id) === String(target.id));
    if (!existsInSelectedBox) {
      setTarget(null);
    }
  }, [selectedTargetBox, target]);

  useEffect(() => {
    if (!target) return;
    if (!validTargetItemIds.has(String(target.id))) {
      setTarget(null);
    }
  }, [target, validTargetItemIds]);

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

      <main className="max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[340px_1fr_340px] gap-4 lg:gap-8 p-3 sm:p-4 lg:p-8">
        <section className={`order-3 lg:order-1 flex-col gap-4 overflow-hidden ${activeTab === 'inventory' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Your Inventory <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">{inventoryItems.length}</span></h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 max-h-[280px] sm:max-h-[380px] lg:max-h-none overflow-y-auto pr-1 custom-scrollbar">
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

        <section
          className="order-1 lg:order-2 reactor-stage flex flex-col items-center justify-center bg-white/[0.02] rounded-[24px] border border-violet-400/10 relative overflow-hidden p-4 sm:p-6"
          style={{ ['--reactor-glow-rgb' as string]: reactorGlowRgb }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] sm:w-[420px] sm:h-[420px] bg-violet-500/20 blur-[80px] rounded-full pointer-events-none" />

          <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-8">
              <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-xl border-2 flex items-center justify-center ${sourcePreview ? 'border-violet-400/50 bg-violet-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                {sourcePreview ? <img src={sourcePreview.image} alt={sourcePreview.name} className="w-14 h-14 sm:w-20 sm:h-20 object-contain" /> : <LucideChevronLeft className="text-white/15" />}
              </div>
              <LucideArrowRight className={`w-4 h-4 sm:w-6 sm:h-6 ${sourcePreview && targetPreview ? 'text-violet-400' : 'text-white/20'}`} />
              <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-xl border-2 flex items-center justify-center ${targetPreview ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                {targetPreview ? <img src={targetPreview.image} alt={targetPreview.name} className="w-14 h-14 sm:w-20 sm:h-20 object-contain" /> : <LucideChevronRight className="text-white/15" />}
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

            <div className="mt-4 w-full">
              <button
                onClick={handleUpgrade}
                disabled={status !== 'idle' || !source || !target || !settings?.enabled || isSubmitting}
                className={`reactor-upgrade-btn w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base uppercase tracking-widest transition-all duration-300 ${status === 'idle' && source && target && settings?.enabled ? 'reactor-upgrade-btn-idle bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
              >
                {status === 'spinning' ? 'Upgrading...' : 'Upgrade Item'}
              </button>

              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                <LucideInfo className="w-3 h-3" />
                <span>Provably Fair System</span>
              </div>
            </div>
          </div>
        </section>

        <div className="order-2 flex lg:hidden bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'inventory' ? 'bg-violet-500 text-white' : 'text-slate-400'}`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('targets')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'targets' ? 'bg-cyan-500 text-[#03111a]' : 'text-slate-400'}`}
          >
            Targets
          </button>
        </div>

        <section className={`order-4 lg:order-3 flex-col gap-4 overflow-hidden ${activeTab === 'targets' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {targetSelectionStep === 'boxes' ? 'Mystery Boxes' : 'Box Items'}
              <span className="ml-1.5 bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                {targetSelectionStep === 'boxes' ? selectableTargetBoxes.length : targetItems.length}
              </span>
            </h2>
            {selectedTargetBox && (
              <button
                type="button"
                onClick={() => {
                  setTargetSelectionStep('boxes');
                  setTarget(null);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10"
              >
                Change Box
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2 sm:p-3 h-[240px] sm:h-[390px] lg:h-[520px] overflow-y-auto custom-scrollbar">
            {targetSelectionStep === 'boxes' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 pr-1">
                {selectableTargetBoxes.map((box) => {
                  const isSelected = selectedTargetBoxId === box.id;
                  const minPrice = box.items.reduce((lowest, entry) => Math.min(lowest, Number(entry.price ?? 0)), Number.POSITIVE_INFINITY);
                  return (
                    <button
                      key={box.id}
                      type="button"
                      onClick={() => {
                        setSelectedTargetBoxId(box.id);
                        setTarget(null);
                        setTargetSelectionStep('items');
                      }}
                      disabled={status === 'spinning' || loading}
                      className={`rounded-xl border p-3 text-left transition ${isSelected ? 'border-cyan-400/70 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'} ${(status === 'spinning' || loading) ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={box.image} alt={box.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{box.name}</p>
                          <p className="text-xs text-slate-300">{box.items.length} items</p>
                          <p className="text-[11px] font-semibold text-amber-300">
                            From <CoinAmount amount={Math.round(Number.isFinite(minPrice) ? minPrice : 0)} iconClassName="h-3 w-3" />
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {selectableTargetBoxes.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
                    No active mystery boxes are available right now.
                  </p>
                )}
              </div>
            )}

            {targetSelectionStep === 'items' && (
              <div className="space-y-2">
                {selectedTargetBox && (
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2 text-xs text-cyan-100">
                    Selected box: <span className="font-semibold">{selectedTargetBox.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 pr-1">
                  {targetItems.map((item) => (
                    <div key={item.id} className="relative">
                      <ItemCard
                        item={item}
                        isSelected={target?.id === item.id}
                        onInfoClick={setDetailsItem}
                        onClick={() => {
                          const match = itemsForSelectedBox.find((entry) => entry.id === item.id) ?? null;
                          if (!match || !validTargetItemIds.has(String(match.id))) return;
                          setTarget(match);
                        }}
                        disabled={status === 'spinning' || loading || !validTargetItemIds.has(String(item.id))}
                      />
                      {!validTargetItemIds.has(String(item.id)) && (
                        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border border-rose-400/40 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-100">
                          Unavailable
                        </span>
                      )}
                    </div>
                  ))}
                  {targetItems.length === 0 && (
                    <p className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
                      Select a mystery box first to choose a target item.
                    </p>
                  )}
                </div>
              </div>
            )}
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
                  <p className="text-slate-300">Pick an active mystery box, then choose the item inside it you want to upgrade to. Your win chance adjusts automatically based on value difference.</p>
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
