import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LucideArrowRight,
  LucideHistory,
  LucideInfo,
  LucideZap,
  LucideChevronLeft,
  LucideChevronRight,
  LucideVolume2,
  LucideVolumeX,
  LucideX
} from 'lucide-react';
import { InventoryItem, Item, Rarity } from '../components/upgrader/upgraderTypes';
import { useGame } from '../../context/GameContext';
import { attemptUpgrade, getUpgraderSettings, getUpgraderTargets } from '../../services/upgraderService';
import { computeUpgradeChance, UpgraderSettings } from '../../utils/upgrader';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
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

export default function UpgraderPage() {
  const { inventory, isAuthenticated, openAuthModal } = useGame();
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
  const [infoItem, setInfoItem] = useState<{ item: EliteItem; origin: 'Inventory' | 'Target' } | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedSpinNonceRef = useRef<number>(0);
  const [spinnerSize, setSpinnerSize] = useState<number>(290);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('upgrader-audio-muted') === '1';
  });

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

  const inventoryItems = useMemo(() => realInventoryItems.map((item) => mapToEliteItem(item)), [realInventoryItems]);
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
    if (!source || !target || !settings || isSubmitting || status === 'spinning') return;

    setError(null);
    setIsSubmitting(true);
    setStatus('spinning');

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
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter text-white">ELITE <span className="text-violet-400">UPGRADER</span></h1>
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
          <LucideHistory className="w-5 h-5 text-slate-400" />
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[340px_1fr_340px] gap-4 lg:gap-8 p-3 sm:p-4 lg:p-8">
        {error && <div className="lg:col-span-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200 text-sm">{error}</div>}

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
                onClick={() => {
                  const match = realInventoryItems.find((entry) => entry.id === item.id) ?? null;
                  setSource(match);
                }}
                onInfoClick={() => setInfoItem({ item, origin: 'Inventory' })}
                disabled={status === 'spinning' || loading}
              />
            ))}
          </div>
        </section>

        <section className="order-1 lg:order-2 flex flex-col items-center justify-center bg-white/[0.02] rounded-[24px] border border-violet-400/10 relative overflow-hidden p-4 sm:p-6">
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
              size={spinnerSize}
              durationMs={SPIN_DURATION_MS}
            />

            <div className="mt-4 w-full">
              <button
                onClick={handleUpgrade}
                disabled={status !== 'idle' || !source || !target || !settings?.enabled || isSubmitting}
                className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base uppercase tracking-widest transition-all duration-300 ${status === 'idle' && source && target && settings?.enabled ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Target Items <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">{targetItems.length}</span></h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 max-h-[220px] sm:max-h-[380px] lg:max-h-none overflow-y-auto pr-1 custom-scrollbar">
            {targetItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={target?.id === item.id}
                onClick={() => {
                  const match = filteredTargets.find((entry) => entry.id === item.id) ?? null;
                  setTarget(match);
                }}
                onInfoClick={() => setInfoItem({ item, origin: 'Target' })}
                disabled={status === 'spinning' || loading}
              />
            ))}
          </div>
        </section>
      </main>


      <div className={`fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${infoItem ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setInfoItem(null)} />
      <div className={`fixed bottom-0 left-0 right-0 z-[120] transform transition-transform duration-500 ${infoItem ? 'translate-y-0' : 'translate-y-full'}`}>
        {infoItem && (
          <div role="dialog" aria-modal="true" aria-labelledby="upgrader-item-details-title" className="mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)]">
            <div className="relative flex h-56 items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(circle at top, rgba(139,92,246,0.45) 0%, transparent 72%)' }}>
              <button
                type="button"
                onClick={() => setInfoItem(null)}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
                aria-label="Close item details"
              >
                <LucideX className="h-4 w-4" />
              </button>
              <img src={infoItem.item.image} alt={infoItem.item.name} className="relative z-10 h-40 w-40 object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
            </div>
            <div className="space-y-4 px-5 py-6 sm:px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="text-center">
                <h3 id="upgrader-item-details-title" className="text-xl font-bold text-white">{infoItem.item.name}</h3>
                <div className="mt-2 inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-violet-200">
                  {infoItem.item.rarity}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Value</span>
                  <div className="mt-1 text-lg font-bold text-white">
                    <CoinAmount amount={Math.round(infoItem.item.price)} iconClassName="h-4 w-4" />
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Type</span>
                  <div className="mt-1 text-sm font-bold text-white">{infoItem.origin} Item</div>
                </div>
              </div>

              <button type="button" onClick={() => setInfoItem(null)} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
