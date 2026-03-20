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

const DEMO_INVENTORY_SIZE = 6;

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const buildDemoInventory = (boxes: Array<{ id: string; name: string; items: Array<{ id: string; name: string; image: string; price: number; rarity: string; category?: string }> }>): InventoryItem[] => {
  const candidates = shuffle(
    boxes.flatMap((box) =>
      (box.items ?? []).map((item, itemIndex) => ({
        id: `demo-${box.id}-${item.id}-${itemIndex}`,
        name: item.name,
        imageUrl: item.image,
        coinValue: toCoins(Number(item.price ?? 0), PRICE_UNIT_MODE),
        rarity: rarityMap[String(item.rarity).toLowerCase()] ?? 'Common',
        category: item.category || box.name || 'Demo Box',
        locked: false,
        shipping: false
      }))
    )
  );

  return candidates.slice(0, DEMO_INVENTORY_SIZE);
};

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
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ item: EliteItem; success: boolean; date: number }>>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'targets'>('inventory');
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
  const [demoInventory, setDemoInventory] = useState<InventoryItem[]>([]);

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
        setError(loadError instanceof Error ? loadError.message : 'Failed to load upgrader data.');
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

  useEffect(() => {
    if (isAuthenticated) return;
    if (demoInventory.length > 0) return;
    if (boxes.length === 0) return;
    setDemoInventory(buildDemoInventory(boxes));
  }, [boxes, demoInventory.length, isAuthenticated]);

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

  const availableInventoryItems = useMemo(() => (isAuthenticated ? realInventoryItems : demoInventory), [demoInventory, isAuthenticated, realInventoryItems]);
  const inventoryLabel = isAuthenticated ? 'Your Inventory' : 'Demo Inventory';
  const inventoryItems = useMemo(() => availableInventoryItems.map((item) => mapToEliteItem(item)), [availableInventoryItems]);
  const targetItems = useMemo(() => filteredTargets.map((item) => mapToEliteItem(item)), [filteredTargets]);

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
    if (!source || !target || isSubmitting || status === 'spinning') return;
    if (!isAuthenticated && !source.id.startsWith('demo-')) return;
    if (isAuthenticated && !settings) return;

    setError(null);
    setIsSubmitting(true);
    setStatus('spinning');

    if (!isMuted && spinAudioRef.current) {
      lastPlayedSpinNonceRef.current = spinNonce + 1;
      spinAudioRef.current.currentTime = 0;
      void spinAudioRef.current.play().catch(() => undefined);
    }

    try {
      if (isAuthenticated) {
        const response = await attemptUpgrade({
          sourceItemInstanceId: source.id,
          targetItemId: target.id,
          clientSeed: `${Date.now()}`
        });

        const success = Boolean(response.win);
        setSpinResult(success);
        setSpinRotation((previous) => previous + computeSpinDelta(chance, success, previous, winZoneRotation));
        setSpinNonce((previous) => previous + 1);
        return;
      }

      const success = Math.random() * 100 <= chance;
      setSpinResult(success);
      setSpinRotation((previous) => previous + computeSpinDelta(chance, success, previous, winZoneRotation));
      setSpinNonce((previous) => previous + 1);
    } catch (attemptError) {
      setStatus('idle');
      setError(attemptError instanceof Error ? attemptError.message : 'Upgrade failed.');
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

    if (!isAuthenticated && source) {
      setDemoInventory((previous) => {
        const withoutSource = previous.filter((item) => item.id !== source.id);
        if (!success || !target) return withoutSource;
        return [
          {
            id: `demo-win-${target.id}-${Date.now()}`,
            name: target.name,
            imageUrl: target.imageUrl,
            coinValue: target.coinValue,
            rarity: target.rarity,
            category: target.category,
            locked: false,
            shipping: false
          },
          ...withoutSource
        ].slice(0, DEMO_INVENTORY_SIZE);
      });
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
        {error && <div className="lg:col-span-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200 text-sm">{error}</div>}
        {!isAuthenticated && (
          <section className="order-0 lg:col-span-3 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-slate-900/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">Demo Mode</p>
                <h2 className="text-lg font-black text-white sm:text-xl">Try the upgrader before you sign in.</h2>
                <p className="max-w-2xl text-sm text-slate-300">We filled this demo inventory with random drops from random boxes so guests can test the flow on mobile or desktop before using real items.</p>
              </div>
              <div className="flex flex-col gap-2 sm:w-auto sm:min-w-[220px]">
                <button
                  type="button"
                  onClick={() => {
                    setDemoInventory(buildDemoInventory(boxes));
                    setSource(null);
                    setTarget(null);
                    setStatus('idle');
                    setSpinResult(null);
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Refresh Demo Inventory
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"
                >
                  Sign In for Real Upgrades
                </button>
              </div>
            </div>
          </section>
        )}

        <section className={`order-3 lg:order-1 flex-col gap-4 overflow-hidden ${activeTab === 'inventory' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{inventoryLabel} <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">{inventoryItems.length}</span></h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 max-h-[280px] sm:max-h-[380px] lg:max-h-none overflow-y-auto pr-1 custom-scrollbar">
            {inventoryItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={source?.id === item.id}
                onInfoClick={setDetailsItem}
                onClick={() => {
                  const match = availableInventoryItems.find((entry) => entry.id === item.id) ?? null;
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
                disabled={status !== 'idle' || !source || !target || (isAuthenticated ? !settings?.enabled : false) || isSubmitting}
                className={`reactor-upgrade-btn w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base uppercase tracking-widest transition-all duration-300 ${status === 'idle' && source && target && (isAuthenticated ? settings?.enabled : true) ? 'reactor-upgrade-btn-idle bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
              >
                {status === 'spinning' ? 'Upgrading...' : isAuthenticated ? 'Upgrade Item' : 'Demo Upgrade'}
              </button>

              {!isAuthenticated && <p className="mt-3 text-center text-xs text-cyan-200/90">Demo upgrades use random results and never spend real inventory.</p>}
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Target Items <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">{targetItems.length}</span></h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 max-h-[220px] sm:max-h-[380px] lg:max-h-none overflow-y-auto pr-1 custom-scrollbar">
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
