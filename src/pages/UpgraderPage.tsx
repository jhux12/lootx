import React, { useState, useEffect, useMemo } from 'react';
import { UpgraderSourcePanel } from '../components/upgrader/UpgraderSourcePanel';
import { UpgraderTargetPanel } from '../components/upgrader/UpgraderTargetPanel';
import { UpgraderPreviewBar } from '../components/upgrader/UpgraderPreviewBar';
import { UpgraderResultModal } from '../components/upgrader/UpgraderResultModal';
import { InventoryItem, Item, Rarity } from '../components/upgrader/upgraderTypes';
import { Coins } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { attemptUpgrade, getUpgraderSettings, getUpgraderTargets } from '../../services/upgraderService';
import { computeUpgradeChance, UpgraderSettings } from '../../utils/upgrader';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

const rarityMap: Record<string, Rarity> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic'
};

export default function UpgraderPage() {
  const { inventory, isAuthenticated, openAuthModal, user } = useGame();
  const [source, setSource] = useState<InventoryItem | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<UpgraderSettings | null>(null);
  const [targets, setTargets] = useState<Item[]>([]);
  const [resultState, setResultState] = useState<'processing' | 'win' | 'lose'>('processing');
  const [modalTarget, setModalTarget] = useState<Item | null>(null);
  const [modalChance, setModalChance] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      return Math.min(80, Math.max(0.01, fallbackChance));
    }
    return computeUpgradeChance({
      sourceValue: source.coinValue,
      targetValue: target.coinValue,
      settings,
      isSameRarity: String(source.rarity).toLowerCase() === String(target.rarity).toLowerCase()
    }) * 100;
  }, [settings, source, target]);

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
  };

  const handleUpgrade = async () => {
    if (!source || !target || !settings || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    setIsModalOpen(true);
    setResultState('processing');
    setModalTarget(target);
    setModalChance(chance);

    try {
      const response = await attemptUpgrade({
        sourceItemInstanceId: source.id,
        targetItemId: target.id,
        clientSeed: `${Date.now()}`
      });

      setResultState(response.win ? 'win' : 'lose');
      setSource(null);
      setTarget(null);
    } catch (attemptError) {
      setError(attemptError instanceof Error ? attemptError.message : 'Upgrade failed.');
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-[calc(120px+env(safe-area-inset-bottom))] sm:pb-32">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-white">Upgrader</h1>
            <p className="hidden sm:block text-[10px] text-slate-500 font-bold uppercase tracking-widest">High Risk, High Reward</p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-700/80 shadow-inner">
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="font-mono font-bold text-slate-100 text-xs sm:text-base">{Math.round(Number(user?.balance ?? 0)).toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200 text-sm">{error}</div>
        )}

        {realInventoryItems.length === 0 && !loading && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-sm">
            Your inventory has no available items to upgrade yet.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/35 border border-slate-800/50 rounded-2xl p-3 sm:p-6">
              <UpgraderSourcePanel
                items={realInventoryItems}
                selectedId={source?.id || null}
                onSelect={setSource}
                loading={loading}
              />
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900/35 border border-slate-800/50 rounded-2xl p-3 sm:p-6">
              <UpgraderTargetPanel
                items={filteredTargets}
                selectedId={target?.id || null}
                onSelect={setTarget}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </main>

      <UpgraderPreviewBar
        source={source}
        target={target}
        onUpgrade={handleUpgrade}
        disabled={realInventoryItems.length === 0 || !settings?.enabled || isSubmitting}
        chanceOverride={chance}
        settings={settings}
      />

      <UpgraderResultModal
        isOpen={isModalOpen}
        onClose={closeModal}
        target={modalTarget}
        onRetry={handleRetry}
        chance={modalChance}
        status={resultState}
      />
    </div>
  );
}
