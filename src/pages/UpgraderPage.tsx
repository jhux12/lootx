import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LucideHistory,
  LucideSearch,
  LucideSettings2,
  LucideVolume2,
  LucideVolumeX,
  LucideZap
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

const SPIN_DURATION_MS = 5200;

type SortMode = 'value_desc' | 'value_asc' | 'name_asc';

const sortItems = (items: EliteItem[], mode: SortMode) => {
  const sorted = [...items];
  if (mode === 'value_asc') sorted.sort((a, b) => a.price - b.price);
  if (mode === 'value_desc') sorted.sort((a, b) => b.price - a.price);
  if (mode === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
};

const Toolbar = ({
  min,
  max,
  search,
  sort,
  onMin,
  onMax,
  onSearch,
  onSort
}: {
  min: string;
  max: string;
  search: string;
  sort: SortMode;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  onSearch: (value: string) => void;
  onSort: (value: SortMode) => void;
}) => (
  <div className="grid grid-cols-2 gap-2 rounded-xl border border-indigo-300/20 bg-[#090f20] p-2 md:grid-cols-[90px_90px_130px_minmax(0,1fr)_36px]">
    <input value={min} onChange={(e) => onMin(e.target.value)} placeholder="Min" className="h-8 rounded-md border border-indigo-300/20 bg-[#060b19] px-2 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-300/50" />
    <input value={max} onChange={(e) => onMax(e.target.value)} placeholder="Max" className="h-8 rounded-md border border-indigo-300/20 bg-[#060b19] px-2 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-300/50" />
    <select value={sort} onChange={(e) => onSort(e.target.value as SortMode)} className="h-8 rounded-md border border-indigo-300/20 bg-[#060b19] px-2 text-xs text-slate-200 outline-none focus:border-indigo-300/50">
      <option value="value_desc">High Value</option>
      <option value="value_asc">Low Value</option>
      <option value="name_asc">Name</option>
    </select>
    <div className="relative col-span-2 md:col-span-1">
      <LucideSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search item" className="h-8 w-full rounded-md border border-indigo-300/20 bg-[#060b19] pl-7 pr-2 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-300/50" />
    </div>
    <button type="button" className="hidden h-8 items-center justify-center rounded-md border border-indigo-300/25 bg-[#0b1328] text-slate-300 md:flex" aria-label="Filters">
      <LucideSettings2 className="h-3.5 w-3.5" />
    </button>
  </div>
);

const SelectedPreview = ({ label, item }: { label: string; item: EliteItem | null }) => (
  <div className="rounded-2xl border border-indigo-300/20 bg-gradient-to-b from-[#0d142b] to-[#070c18] p-4 sm:p-5">
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <div className="relative mt-4 flex h-[220px] items-center justify-center overflow-hidden rounded-xl border border-indigo-300/15 bg-[#050914]">
      <div className="absolute top-4 h-28 w-40 bg-indigo-300/15 blur-3xl" />
      <div className="absolute bottom-6 h-5 w-36 rounded-[999px] bg-cyan-300/15 blur-md" />
      {item ? (
        <>
          <img src={item.image} alt={item.name} className="relative z-10 h-36 w-36 object-contain" referrerPolicy="no-referrer" />
          <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-indigo-300/20 bg-[#0b1228]/90 px-2 py-1 text-center">
            <p className="truncate text-xs font-semibold text-white">{item.name}</p>
            <CoinAmount amount={Math.round(item.price)} className="justify-center text-[11px] text-slate-200" iconClassName="h-3 w-3" />
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full border border-dashed border-slate-600/80" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">Select an item</p>
        </div>
      )}
    </div>
  </div>
);

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

  const [inventoryMin, setInventoryMin] = useState('');
  const [inventoryMax, setInventoryMax] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState<SortMode>('value_desc');
  const [targetMin, setTargetMin] = useState('');
  const [targetMax, setTargetMax] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [targetSort, setTargetSort] = useState<SortMode>('value_desc');

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

    const handleResize = () => setSpinnerSize(window.innerWidth < 640 ? 220 : 290);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      if (idleTimeoutRef.current) window.clearTimeout(idleTimeoutRef.current);
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

  const filteredInventoryItems = useMemo(() => {
    const min = Number(inventoryMin || 0);
    const max = Number(inventoryMax || Number.MAX_SAFE_INTEGER);
    const search = inventorySearch.trim().toLowerCase();
    const filtered = inventoryItems.filter((item) => item.price >= min && item.price <= max && item.name.toLowerCase().includes(search));
    return sortItems(filtered, inventorySort);
  }, [inventoryItems, inventoryMax, inventoryMin, inventorySearch, inventorySort]);

  const filteredTargetItems = useMemo(() => {
    const min = Number(targetMin || 0);
    const max = Number(targetMax || Number.MAX_SAFE_INTEGER);
    const search = targetSearch.trim().toLowerCase();
    const filtered = targetItems.filter((item) => item.price >= min && item.price <= max && item.name.toLowerCase().includes(search));
    return sortItems(filtered, targetSort);
  }, [targetItems, targetMax, targetMin, targetSearch, targetSort]);

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
    if (!source || !target) setWinZoneRotation(0);
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
      const response = await attemptUpgrade({ sourceItemInstanceId: source.id, targetItemId: target.id, clientSeed: `${Date.now()}` });
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
    if (idleTimeoutRef.current) window.clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = window.setTimeout(() => setStatus('idle'), 1200);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center sm:p-8">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">Upgrader</h1>
          <p className="text-sm text-slate-300">Sign in to use your real inventory items in the upgrader.</p>
          <button onClick={() => openAuthModal('login')} className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition-colors hover:bg-indigo-500">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04070f] pb-44 font-sans text-slate-200 lg:pb-32">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-indigo-300/10 bg-[#070b17]/90 px-4 backdrop-blur-xl lg:px-8">
        <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Elite Upgrader</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsMuted((previous) => !previous)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300/20 bg-[#0c1430] text-slate-300 hover:text-white" aria-label={isMuted ? 'Unmute upgrader sound' : 'Mute upgrader sound'}>
            {isMuted ? <LucideVolumeX className="h-4 w-4" /> : <LucideVolume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setIsHelpOpen(true)} className="h-9 rounded-lg border border-indigo-300/20 bg-[#0c1430] px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Help</button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 sm:gap-6 sm:p-4 lg:p-8">
        <section className="rounded-2xl border border-indigo-300/15 bg-[#080d1c] p-3 sm:p-5">
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_minmax(320px,460px)_1fr] lg:gap-6">
            <SelectedPreview label="Your Item" item={sourcePreview} />

            <div className="flex flex-col items-center rounded-2xl border border-indigo-300/20 bg-gradient-to-b from-[#0b1228] to-[#060b17] p-4">
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

              <div className="mt-2 flex w-full max-w-[340px] items-center justify-center gap-2">
                <button type="button" onClick={() => setSpinRotation((p) => p + 360)} className="h-9 rounded-lg border border-indigo-300/25 bg-[#0b1430] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">Demo Spin</button>
                <button onClick={handleUpgrade} disabled={status !== 'idle' || !source || !target || !settings?.enabled || isSubmitting} className={`h-9 flex-1 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-[0.16em] ${status === 'idle' && source && target && settings?.enabled ? 'border-indigo-300/55 bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'cursor-not-allowed border-indigo-300/20 bg-[#0a1124] text-slate-500'}`}>
                  {status === 'spinning' ? 'Upgrading...' : 'Upgrade'}
                </button>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300/25 bg-[#0b1430] text-slate-200" aria-label="Provably fair">
                  <LucideZap className="h-4 w-4" />
                </button>
              </div>
            </div>

            <SelectedPreview label="Item You Want" item={targetPreview} />
          </div>
        </section>

        <div className="flex rounded-xl border border-indigo-300/15 bg-[#080d1c] p-1 lg:hidden">
          <button onClick={() => setActiveTab('inventory')} className={`flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.14em] ${activeTab === 'inventory' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>Your Items</button>
          <button onClick={() => setActiveTab('targets')} className={`flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.14em] ${activeTab === 'targets' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>Site Items</button>
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className={`${activeTab === 'inventory' ? 'flex' : 'hidden'} min-h-[460px] flex-col rounded-2xl border border-indigo-300/15 bg-[#080d1c] p-3 sm:p-4 lg:flex`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Your Items</h2>
              <span className="rounded-md border border-indigo-300/20 bg-[#101837] px-2 py-0.5 text-[10px] text-slate-300">{filteredInventoryItems.length}</span>
            </div>
            <Toolbar min={inventoryMin} max={inventoryMax} search={inventorySearch} sort={inventorySort} onMin={setInventoryMin} onMax={setInventoryMax} onSearch={setInventorySearch} onSort={setInventorySort} />
            <div className="mt-3 grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 custom-scrollbar">
              {filteredInventoryItems.map((item) => (
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
          </div>

          <div className={`${activeTab === 'targets' ? 'flex' : 'hidden'} min-h-[460px] flex-col rounded-2xl border border-indigo-300/15 bg-[#080d1c] p-3 sm:p-4 lg:flex`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Site Items</h2>
              <span className="rounded-md border border-indigo-300/20 bg-[#101837] px-2 py-0.5 text-[10px] text-slate-300">{filteredTargetItems.length}</span>
            </div>
            <Toolbar min={targetMin} max={targetMax} search={targetSearch} sort={targetSort} onMin={setTargetMin} onMax={setTargetMax} onSearch={setTargetSearch} onSort={setTargetSort} />
            <div className="mt-3 grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 custom-scrollbar">
              {filteredTargetItems.map((item) => (
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
          </div>
        </section>
      </main>

      <div className={`fixed inset-0 z-[72] bg-black/65 backdrop-blur-sm transition-opacity duration-300 ${resultSheet ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setResultSheet(null)} />
      <div className={`fixed inset-x-0 bottom-0 z-[73] transform px-3 pb-[max(env(safe-area-inset-bottom),12px)] transition-transform duration-300 sm:px-4 sm:pb-4 ${resultSheet ? 'translate-y-0' : 'translate-y-full'}`}>
        {resultSheet && (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1524] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`text-sm font-bold uppercase tracking-widest ${resultSheet.success ? 'text-emerald-300' : 'text-rose-300'}`}>{resultSheet.success ? 'Upgrade Success' : 'Upgrade Failed'}</h2>
              <button type="button" onClick={() => setResultSheet(null)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10">Close</button>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <img src={resultSheet.item.image} alt={resultSheet.item.name} className="mx-auto h-28 w-28 rounded-xl object-cover sm:h-32 sm:w-32" referrerPolicy="no-referrer" />
              <p className="mt-3 text-base font-semibold text-white">{resultSheet.item.name}</p>
              <div className="mt-2 flex justify-center"><CoinAmount amount={Math.round(resultSheet.item.price)} className="text-sm font-bold text-amber-300" iconClassName="h-4 w-4" /></div>
            </div>
          </div>
        )}
      </div>

      {detailsItem && (
        <>
          <button type="button" aria-label="Close item details" className="fixed inset-0 z-[70] bg-black/65" onClick={() => setDetailsItem(null)} />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[71] flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-4 sm:pb-4">
            <div role="dialog" aria-modal="true" aria-labelledby="upgrader-item-details-title" className="pointer-events-auto w-full max-w-md animate-[upgraderSheetIn_220ms_ease-out] rounded-2xl border border-white/15 bg-[#0f1524] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="upgrader-item-details-title" className="text-sm font-bold uppercase tracking-widest text-slate-300">Item Details</h2>
                <button type="button" onClick={() => setDetailsItem(null)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10">Close</button>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <img src={detailsItem.image} alt={detailsItem.name} className="mx-auto h-28 w-28 rounded-xl object-cover sm:h-32 sm:w-32" referrerPolicy="no-referrer" />
                <p className="mt-4 text-center text-base font-semibold text-white">{detailsItem.name}</p>
                <div className="mt-2 flex justify-center"><CoinAmount amount={Math.round(detailsItem.price)} className="text-sm font-bold text-amber-300" iconClassName="h-4 w-4" /></div>
              </div>
            </div>
          </div>
        </>
      )}

      {isHelpOpen && (
        <>
          <button type="button" aria-label="Close upgrader help" className="fixed inset-0 z-[70] bg-black/65" onClick={() => setIsHelpOpen(false)} />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[71] flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-4 sm:pb-4">
            <div role="dialog" aria-modal="true" aria-labelledby="upgrader-help-title" className="pointer-events-auto w-full max-w-xl animate-[upgraderSheetIn_220ms_ease-out] rounded-2xl border border-white/15 bg-[#0f1524] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="upgrader-help-title" className="text-sm font-bold uppercase tracking-widest text-slate-300">How the Upgrader Works</h2>
                <button type="button" onClick={() => setIsHelpOpen(false)} className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10">Close</button>
              </div>
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
                <p className="text-slate-300">The Upgrader lets you risk one item for a chance at a higher-value item.</p>
                <p className="text-slate-300">Pick a source item, choose your target, then press Upgrade to spin.</p>
                <p className="font-semibold text-violet-300">Upgrade smart. Higher risk means higher reward.</p>
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="fixed bottom-[calc(env(safe-area-inset-bottom)+62px)] left-0 z-50 flex h-20 w-full items-center gap-3 overflow-x-auto border-t border-white/10 bg-[#080b10]/90 px-3 backdrop-blur-md custom-scrollbar lg:bottom-0 lg:px-8">
        <div className="shrink-0 border-r border-white/10 pr-3">
          <div className="flex items-center gap-2">
            <LucideHistory className="h-4 w-4 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live Feed</span>
          </div>
        </div>
        {history.map((entry) => (
          <div key={entry.date} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 ${entry.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
            <img src={entry.item.image} alt={entry.item.name} className="h-8 w-8 rounded-lg object-cover" />
            <div className="flex flex-col">
              <span className="w-24 truncate text-[10px] font-bold text-white">{entry.item.name}</span>
              <span className={`text-[9px] font-bold uppercase ${entry.success ? 'text-emerald-400' : 'text-rose-400'}`}>{entry.success ? 'Upgrade Success' : 'Upgrade Failed'}</span>
            </div>
          </div>
        ))}
        {history.length === 0 && <p className="text-xs italic text-slate-600">No recent activity</p>}
      </footer>

      <style>{`@keyframes upgraderSheetIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
