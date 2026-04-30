import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LucideHistory,
  LucideSearch,
  CircleHelp,
  LucideSettings2,
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
  category: String(item.category ?? 'General'),
  rarity: normalizeEliteRarity(String(item.rarity ?? 'common'))
});

const SPIN_DURATION_MS = 5200;

type SortMode = 'best_match' | 'value_desc' | 'value_asc' | 'name_asc';
type CategoryFilter = 'all' | 'tech' | 'collectibles' | 'apparel';
type RiskPreset = 'all' | 'safe' | 'balanced' | 'high_risk';

interface GroupedInventoryItem {
  key: string;
  display: EliteItem;
  memberIds: string[];
}

const PANEL_INITIAL_LIMIT = 15;
const PANEL_INCREMENT = 12;

const UPGRADE_PRESETS: Array<{ value: RiskPreset; label: string; helper: string }> = [
  { value: 'all', label: 'All Targets', helper: 'No multiplier constraint' },
  { value: 'safe', label: 'Safe', helper: '1.2x–2x' },
  { value: 'balanced', label: 'Balanced', helper: '2x–4x' },
  { value: 'high_risk', label: 'High Risk', helper: '4x+' }
];

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tech', label: 'Tech' },
  { value: 'collectibles', label: 'Collectibles' },
  { value: 'apparel', label: 'Apparel' }
];

const normalizeCategory = (value?: string): CategoryFilter => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('tech')) return 'tech';
  if (normalized.includes('collect')) return 'collectibles';
  if (normalized.includes('apparel')) return 'apparel';
  return 'all';
};

const sortItems = (items: EliteItem[], mode: SortMode) => {
  const sorted = [...items];
  if (mode === 'value_asc') sorted.sort((a, b) => a.price - b.price);
  if (mode === 'value_desc') sorted.sort((a, b) => b.price - a.price);
  if (mode === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
};

const sortTargetItems = (items: EliteItem[], mode: SortMode, source: InventoryItem | null) => {
  if (mode !== 'best_match') return sortItems(items, mode);
  const sorted = [...items];
  if (!source) return sortItems(sorted, 'value_desc');

  return sorted.sort((a, b) => {
    const aRatio = a.price / Math.max(1, source.coinValue);
    const bRatio = b.price / Math.max(1, source.coinValue);
    const aDistance = Math.abs(aRatio - 2.3);
    const bDistance = Math.abs(bRatio - 2.3);
    if (aDistance !== bDistance) return aDistance - bDistance;
    return a.price - b.price;
  });
};

const getMultiplierLabel = (multiplier: number): string | null => {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
  if (multiplier < 2) return 'Safe';
  if (multiplier < 4) return 'Balanced';
  return 'High Risk';
};

const Toolbar = ({
  min,
  max,
  search,
  sort,
  category,
  upgradePreset,
  sourceSelected,
  includeBestMatch,
  onMin,
  onMax,
  onSearch,
  onSort,
  onCategory,
  onUpgradePreset
}: {
  min: string;
  max: string;
  search: string;
  sort: SortMode;
  category: CategoryFilter;
  upgradePreset?: RiskPreset;
  sourceSelected?: boolean;
  includeBestMatch?: boolean;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  onSearch: (value: string) => void;
  onSort: (value: SortMode) => void;
  onCategory: (value: CategoryFilter) => void;
  onUpgradePreset?: (value: RiskPreset) => void;
}) => (
  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#222a32] p-2 md:grid-cols-[90px_90px_130px_130px_minmax(0,1fr)_36px]">
    <input value={min} onChange={(e) => onMin(e.target.value)} placeholder="Min" className={`h-9 rounded-lg border px-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-white/35 ${min ? 'border-white/30 bg-[#2a323b]' : 'border-white/15 bg-[#1f252c]'}`} />
    <input value={max} onChange={(e) => onMax(e.target.value)} placeholder="Max" className={`h-9 rounded-lg border px-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-white/35 ${max ? 'border-white/30 bg-[#2a323b]' : 'border-white/15 bg-[#1f252c]'}`} />
    <select value={sort} onChange={(e) => onSort(e.target.value as SortMode)} className={`h-9 rounded-lg border px-2.5 text-xs text-slate-200 outline-none focus:border-white/35 ${sort !== 'value_desc' && sort !== 'best_match' ? 'border-white/30 bg-[#2a323b]' : 'border-white/15 bg-[#1f252c]'}`}>
      {includeBestMatch && <option value="best_match">Best Match</option>}
      <option value="value_desc">High Value</option>
      <option value="value_asc">Low Value</option>
      <option value="name_asc">Name</option>
    </select>
    <select value={category} onChange={(e) => onCategory(e.target.value as CategoryFilter)} className={`h-9 rounded-lg border px-2.5 text-xs text-slate-200 outline-none focus:border-white/35 ${category !== 'all' ? 'border-white/30 bg-[#2a323b]' : 'border-white/15 bg-[#1f252c]'}`}>
      {CATEGORY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
    <div className="relative col-span-2 md:col-span-1">
      <LucideSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search item" className={`h-9 w-full rounded-lg border pl-7 pr-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-white/35 ${search ? 'border-white/30 bg-[#2a323b]' : 'border-white/15 bg-[#1f252c]'}`} />
    </div>
    <button type="button" className="hidden h-9 items-center justify-center rounded-lg border border-white/15 bg-[#1f252c] text-slate-300 md:flex" aria-label="Filters">
      <LucideSettings2 className="h-3.5 w-3.5" />
    </button>
    {onUpgradePreset && (
      <div className="col-span-2 mt-1 flex flex-wrap items-center gap-1 md:col-span-6">
        {UPGRADE_PRESETS.map((preset) => {
          const isActive = upgradePreset === preset.value;
          const isDisabled = preset.value !== 'all' && !sourceSelected;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onUpgradePreset(preset.value)}
              disabled={isDisabled}
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${isActive ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-100' : 'border-indigo-300/20 bg-[#0a1124] text-slate-400 hover:border-indigo-300/40 hover:text-slate-200'} ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
              title={preset.helper}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    )}
  </div>
);

const SelectedPreview = ({ label, item, emptyText, onActivate }: { label: string; item: EliteItem | null; emptyText: string; onActivate: () => void }) => (
  <div className="rounded-2xl border border-white/10 bg-[#1f252c] p-4 sm:p-5">
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <button type="button" onClick={onActivate} className="relative mt-4 flex h-[240px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-transparent px-3 pb-3 pt-4 transition hover:border-white/35 sm:h-[250px]">
      {item ? (
        <>
          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
            <img src={item.image} alt={item.name} className="max-h-[140px] w-auto max-w-[140px] object-contain sm:max-h-[155px] sm:max-w-[155px]" referrerPolicy="no-referrer" />
          </div>
          <div className="relative z-10 w-full rounded-lg border border-white/10 bg-[#2a323b] px-2 py-1 text-center">
            <CoinAmount amount={Math.round(item.price)} className="justify-center text-[11px] text-slate-200" iconClassName="h-3 w-3" />
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-white/25 text-5xl font-light text-white/85">+</div>
          <p className="mt-3 px-4 text-sm text-slate-300">{emptyText}</p>
        </div>
      )}
    </button>
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
  const inventoryPanelRef = useRef<HTMLDivElement | null>(null);
  const targetPanelRef = useRef<HTMLDivElement | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedResultRef = useRef<string | null>(null);
  const [spinnerSize, setSpinnerSize] = useState<number>(290);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('upgrader-audio-muted') === '1';
  });

  const jumpToPanel = (panel: 'inventory' | 'targets') => {
    setActiveTab(panel);
    window.setTimeout(() => {
      const targetNode = panel === 'inventory' ? inventoryPanelRef.current : targetPanelRef.current;
      targetNode?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const [inventoryMin, setInventoryMin] = useState('');
  const [inventoryMax, setInventoryMax] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState<SortMode>('value_desc');
  const [inventoryCategory, setInventoryCategory] = useState<CategoryFilter>('all');
  const [targetMin, setTargetMin] = useState('');
  const [targetMax, setTargetMax] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [targetSort, setTargetSort] = useState<SortMode>('best_match');
  const [targetCategory, setTargetCategory] = useState<CategoryFilter>('all');
  const [targetRiskPreset, setTargetRiskPreset] = useState<RiskPreset>('all');
  const [inventoryVisibleCount, setInventoryVisibleCount] = useState(PANEL_INITIAL_LIMIT);
  const [targetVisibleCount, setTargetVisibleCount] = useState(PANEL_INITIAL_LIMIT);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [resultSheet, setResultSheet] = useState<{ item: EliteItem; success: boolean } | null>(null);
  const [isDemoSpin, setIsDemoSpin] = useState(false);

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
    if (!resultSheet?.success) return;
    const resultKey = `${resultSheet.item.id}-${resultSheet.item.price}-${resultSheet.success}`;
    if (lastPlayedResultRef.current === resultKey) return;

    lastPlayedResultRef.current = resultKey;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [isMuted, resultSheet]);

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

    const handleResize = () => setSpinnerSize(window.innerWidth < 640 ? 245 : 330);
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

  const groupedInventoryItems = useMemo<GroupedInventoryItem[]>(() => {
    const grouped = new Map<string, GroupedInventoryItem>();
    inventoryItems.forEach((item) => {
      const key = `${item.name.toLowerCase()}|${item.image}|${item.price}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.memberIds.push(item.id);
      } else {
        grouped.set(key, { key, display: item, memberIds: [item.id] });
      }
    });
    return [...grouped.values()];
  }, [inventoryItems]);

  const filteredInventoryItems = useMemo(() => {
    const min = Number(inventoryMin || 0);
    const max = Number(inventoryMax || Number.MAX_SAFE_INTEGER);
    const search = inventorySearch.trim().toLowerCase();
    const filtered = groupedInventoryItems.filter((group) => {
      const matchesCategory = inventoryCategory === 'all' || normalizeCategory(group.display.category) === inventoryCategory;
      return matchesCategory && group.display.price >= min && group.display.price <= max && group.display.name.toLowerCase().includes(search);
    });
    return sortItems(filtered.map((entry) => entry.display), inventorySort)
      .map((sortedItem) => groupedInventoryItems.find((group) => group.display.id === sortedItem.id))
      .filter((entry): entry is GroupedInventoryItem => Boolean(entry));
  }, [groupedInventoryItems, inventoryCategory, inventoryMax, inventoryMin, inventorySearch, inventorySort]);

  const filteredTargetItems = useMemo(() => {
    const min = Number(targetMin || 0);
    const max = Number(targetMax || Number.MAX_SAFE_INTEGER);
    const search = targetSearch.trim().toLowerCase();
    const filtered = targetItems.filter((item) => {
      const matchesCategory = targetCategory === 'all' || normalizeCategory(item.category) === targetCategory;
      const multiplier = source ? item.price / Math.max(1, source.coinValue) : null;
      const passesPreset = targetRiskPreset === 'all'
        || (!source ? false : targetRiskPreset === 'safe' ? multiplier! >= 1.2 && multiplier! < 2 : targetRiskPreset === 'balanced' ? multiplier! >= 2 && multiplier! < 4 : multiplier! >= 4);
      return matchesCategory && item.price >= min && item.price <= max && item.name.toLowerCase().includes(search) && passesPreset;
    });
    return sortTargetItems(filtered, targetSort, source);
  }, [source, targetCategory, targetItems, targetMax, targetMin, targetRiskPreset, targetSearch, targetSort]);

  const suggestedTargets = useMemo(() => {
    if (!source) return [];
    const ranges = [
      { min: 1.5, max: 2, label: 'Safe' },
      { min: 2, max: 4, label: 'Balanced' },
      { min: 4, max: Number.POSITIVE_INFINITY, label: 'High Risk' }
    ] as const;

    return ranges
      .map((range) => {
        const desired = source.coinValue * (range.min === 4 ? 4.4 : (range.min + range.max) / 2);
        const candidate = targetItems
          .filter((item) => {
            const ratio = item.price / Math.max(1, source.coinValue);
            return ratio >= range.min && ratio < range.max;
          })
          .sort((a, b) => Math.abs(a.price - desired) - Math.abs(b.price - desired))[0];
        return candidate ? { item: candidate, label: range.label } : null;
      })
      .filter((entry): entry is { item: EliteItem; label: string } => Boolean(entry));
  }, [source, targetItems]);

  const visibleInventoryItems = useMemo(
    () => filteredInventoryItems.slice(0, inventoryVisibleCount),
    [filteredInventoryItems, inventoryVisibleCount]
  );
  const visibleTargetItems = useMemo(
    () => filteredTargetItems.slice(0, targetVisibleCount),
    [filteredTargetItems, targetVisibleCount]
  );

  useEffect(() => {
    setInventoryVisibleCount(PANEL_INITIAL_LIMIT);
  }, [inventoryMin, inventoryMax, inventorySearch, inventorySort, inventoryCategory, groupedInventoryItems.length]);

  useEffect(() => {
    setTargetVisibleCount(PANEL_INITIAL_LIMIT);
  }, [targetMin, targetMax, targetSearch, targetSort, targetCategory, targetRiskPreset, source?.id, targetItems.length]);

  useEffect(() => {
    if (!source && targetRiskPreset !== 'all') {
      setTargetRiskPreset('all');
    }
  }, [source, targetRiskPreset]);

  const sourcePreview = source ? mapToEliteItem(source) : null;
  const targetPreview = target ? mapToEliteItem(target) : null;
  const valueMultiplier = source && target ? target.coinValue / Math.max(1, source.coinValue) : 0;

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

  const handleDemoSpin = () => {
    if (!source || !target || status === 'spinning') return;
    const success = Math.random() * 100 < chance;
    setIsDemoSpin(true);
    setStatus('spinning');
    setSpinResult(success);
    setSpinRotation((previous) => previous + computeSpinDelta(chance, success, previous, winZoneRotation));
    setSpinNonce((previous) => previous + 1);
  };

  const handleSpinComplete = (success: boolean) => {
    setStatus(success ? 'success' : 'fail');

    if (isDemoSpin) {
      setSpinResult(null);
      setIsDemoSpin(false);
      if (idleTimeoutRef.current) window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = window.setTimeout(() => setStatus('idle'), 900);
      return;
    }

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
    <div className="min-h-screen bg-[#1b2024] pb-44 font-sans text-slate-200 lg:pb-32">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-end border-b border-indigo-300/10 bg-[#050916]/86 px-4 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsMuted((previous) => !previous)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300/20 bg-[#0c1430] text-slate-300 hover:text-white" aria-label={isMuted ? 'Unmute upgrader sound' : 'Mute upgrader sound'}>
            {isMuted ? <LucideVolumeX className="h-4 w-4" /> : <LucideVolume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setIsHelpOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300/20 bg-[#0c1430] text-slate-300 transition duration-200 hover:scale-[1.03] hover:text-white" aria-label="Upgrader help">
            <CircleHelp className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 sm:gap-6 sm:p-4 lg:p-8">
        <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-transparent p-3 sm:p-4">
          <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <p className="text-xl font-black text-white">Upgrader</p>
            <div className="hidden items-center gap-2 sm:flex">
              <button type="button" onClick={() => setIsMuted((previous) => !previous)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-300/20 bg-[#0c1430] text-slate-300 hover:text-white" aria-label={isMuted ? 'Unmute upgrader sound' : 'Mute upgrader sound'}>
                {isMuted ? <LucideVolumeX className="h-4 w-4" /> : <LucideVolume2 className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setIsHelpOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-300/20 bg-[#0c1430] text-slate-300 transition duration-200 hover:scale-[1.03] hover:text-white" aria-label="Upgrader help">
                <CircleHelp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_minmax(320px,460px)_1fr] lg:gap-6">
            <SelectedPreview label="Your Item" item={sourcePreview} emptyText="Choose an item to upgrade" onActivate={() => jumpToPanel('inventory')} />

            <div className="relative flex flex-col items-center rounded-2xl border border-white/5 bg-[#1f252c] p-4">
              <UpgraderSpinner
                chance={chance}
                hasSource={Boolean(source)}
                hasTarget={Boolean(target)}
                targetImage={targetPreview?.image}
                targetName={targetPreview?.name}
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
              <div className="mt-3 flex w-full max-w-[460px] flex-col items-center justify-center gap-2 sm:flex-row">
                <button onClick={handleUpgrade} disabled={status !== 'idle' || !source || !target || !settings?.enabled || isSubmitting} className={`h-11 w-full flex-1 rounded-lg border px-4 text-base font-bold transition duration-200 ${status === 'idle' && source && target && settings?.enabled ? 'border-emerald-300/40 bg-[#49b879] text-white hover:brightness-105' : 'cursor-not-allowed border-white/10 bg-[#24313b] text-slate-500'}`}>
                  {status === 'spinning' ? 'Upgrading...' : 'Upgrade'}
                </button>
                <button type="button" disabled={!source || !target || status === 'spinning'} onClick={handleDemoSpin} className={`h-11 w-full rounded-lg border px-4 text-lg font-bold transition sm:w-auto ${source && target && status !== 'spinning' ? 'border-white/10 bg-[#343c46] text-white hover:bg-[#3b4551]' : 'cursor-not-allowed border-white/10 bg-[#24313b] text-slate-500'}`}>Demo Spin</button>
              </div>
            </div>

            <SelectedPreview label="Item You Want" item={targetPreview} emptyText="Select your target item" onActivate={() => jumpToPanel('targets')} />
          </div>
        </section>

        <div className="flex rounded-xl border border-white/10 bg-[#1f252c] p-1 lg:hidden">
          <button onClick={() => setActiveTab('inventory')} className={`flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.14em] ${activeTab === 'inventory' ? 'bg-[#343c46] text-white' : 'text-slate-400'}`}>Your Items</button>
          <button onClick={() => setActiveTab('targets')} className={`flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.14em] ${activeTab === 'targets' ? 'bg-[#343c46] text-white' : 'text-slate-400'}`}>Site Items</button>
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div ref={inventoryPanelRef} className={`${activeTab === 'inventory' ? 'flex' : 'hidden'} min-h-[460px] flex-col rounded-2xl border border-white/10 bg-[#1f252c] p-3 sm:p-4 lg:flex`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your Items</h2>
              <span className="rounded-md border border-white/15 bg-[#2a323b] px-2 py-0.5 text-[10px] text-slate-300">{filteredInventoryItems.length}</span>
            </div>
            <Toolbar min={inventoryMin} max={inventoryMax} search={inventorySearch} sort={inventorySort} category={inventoryCategory} onMin={setInventoryMin} onMax={setInventoryMax} onSearch={setInventorySearch} onSort={setInventorySort} onCategory={setInventoryCategory} />
            <div className="mt-3 grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 custom-scrollbar">
              {visibleInventoryItems.map((group) => (
                <ItemCard
                  key={group.key}
                  item={group.display}
                  quantityBadge={group.memberIds.length}
                  tone="source"
                  isSelected={Boolean(source?.id && group.memberIds.includes(source.id))}
                  onInfoClick={setDetailsItem}
                  onClick={() => {
                    const preferredId = source?.id && group.memberIds.includes(source.id) ? source.id : group.memberIds[0];
                    const match = realInventoryItems.find((entry) => entry.id === preferredId) ?? null;
                    setSource(match);
                  }}
                  disabled={status === 'spinning' || loading}
                />
              ))}
            </div>
            {filteredInventoryItems.length === 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-white/20 bg-[#222a32] p-4 text-center text-xs text-slate-400">
                No items match your filters. Adjust your search or range.
              </div>
            )}
            {filteredInventoryItems.length > visibleInventoryItems.length && (
              <button
                type="button"
                onClick={() => setInventoryVisibleCount((previous) => previous + PANEL_INCREMENT)}
                className="mt-3 h-9 rounded-lg border border-white/20 bg-[#2a323b] text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-white/35 hover:text-white"
              >
                Load More ({filteredInventoryItems.length - visibleInventoryItems.length} left)
              </button>
            )}
          </div>

          <div ref={targetPanelRef} className={`${activeTab === 'targets' ? 'flex' : 'hidden'} min-h-[460px] flex-col rounded-2xl border border-white/10 bg-[#1f252c] p-3 sm:p-4 lg:flex`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">Site Items</h2>
              <span className="rounded-md border border-white/15 bg-[#2a323b] px-2 py-0.5 text-[10px] text-slate-300">{filteredTargetItems.length}</span>
            </div>
            <Toolbar min={targetMin} max={targetMax} search={targetSearch} sort={targetSort} category={targetCategory} includeBestMatch upgradePreset={targetRiskPreset} sourceSelected={Boolean(source)} onUpgradePreset={setTargetRiskPreset} onMin={setTargetMin} onMax={setTargetMax} onSearch={setTargetSearch} onSort={setTargetSort} onCategory={setTargetCategory} />
            {!source && (
              <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-[#222a32] p-3 text-xs text-slate-400">
                Select your source item on the left to unlock best-match sorting, suggested targets, and risk presets.
              </div>
            )}
            {source && suggestedTargets.length > 0 && (
              <div className="mt-3 rounded-xl border border-white/15 bg-[#222a32] p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">Suggested Upgrades</p>
                  <p className="text-[10px] text-slate-400">Safe · Balanced · High Risk</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {suggestedTargets.map(({ item, label }) => (
                    <button
                      key={`suggested-${item.id}`}
                      type="button"
                      onClick={() => {
                        const match = filteredTargets.find((entry) => entry.id === item.id) ?? null;
                        setTarget(match);
                      }}
                      className="rounded-lg border border-white/15 bg-[#2a323b] p-2 text-left transition hover:border-white/30 hover:bg-[#343c46]"
                    >
                      <p className="truncate text-[10px] font-semibold text-slate-100">{item.name}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-cyan-200">{label}</p>
                      <p className="mt-1 text-[10px] text-cyan-300">{(item.price / Math.max(1, source.coinValue)).toFixed(2)}x</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 custom-scrollbar">
              {visibleTargetItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  tone="target"
                  hintLabel={source ? (item.id === suggestedTargets[0]?.item.id ? 'Best Match' : getMultiplierLabel(item.price / Math.max(1, source.coinValue)) ?? undefined) : undefined}
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
            {filteredTargetItems.length === 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-indigo-300/25 bg-[#090f20] p-4 text-center text-xs text-slate-400">
                No target items match your filters right now.
              </div>
            )}
            {filteredTargetItems.length > visibleTargetItems.length && (
              <button
                type="button"
                onClick={() => setTargetVisibleCount((previous) => previous + PANEL_INCREMENT)}
                className="mt-3 h-9 rounded-lg border border-indigo-300/30 bg-[#13224b] text-xs font-semibold uppercase tracking-[0.14em] text-slate-100 transition hover:border-cyan-300/50 hover:text-white"
              >
                Load More ({filteredTargetItems.length - visibleTargetItems.length} left)
              </button>
            )}
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
