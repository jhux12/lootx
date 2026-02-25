import React, { useState, useEffect, useMemo } from 'react';
import { UpgraderSourcePanel } from '../components/upgrader/UpgraderSourcePanel';
import { UpgraderTargetPanel } from '../components/upgrader/UpgraderTargetPanel';
import { UpgraderPreviewBar } from '../components/upgrader/UpgraderPreviewBar';
import { UpgraderResultModal } from '../components/upgrader/UpgraderResultModal';
import { MOCK_TARGETS } from '../components/upgrader/upgraderMockData';
import { InventoryItem, Item, Rarity } from '../components/upgrader/upgraderTypes';
import { Coins } from 'lucide-react';
import { useGame } from '../../context/GameContext';

const rarityMap: Record<string, Rarity> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary'
};

export default function UpgraderPage() {
  const { inventory, isAuthenticated, openAuthModal, user } = useGame();
  const [source, setSource] = useState<InventoryItem | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const realInventoryItems = useMemo<InventoryItem[]>(() => {
    return inventory
      .filter((item) => (item.status ?? 'available') === 'available')
      .map((item) => ({
        id: item.instanceId,
        name: item.name,
        imageUrl: item.image,
        coinValue: Number(item.price ?? 0),
        rarity: rarityMap[item.rarity] ?? 'Common',
        category: item.category || 'General',
        locked: item.locked,
        shipping: item.status === 'shipping' || item.status === 'shipping_requested'
      }));
  }, [inventory]);

  const calculateChance = () => {
    if (!source || !target) return 0;
    const rawChance = (source.coinValue / target.coinValue) * 0.95 * 100;
    return Math.min(Math.max(rawChance, 0.01), 80);
  };

  const chance = calculateChance();

  const handleUpgrade = () => {
    setIsModalOpen(true);
  };

  const handleRetry = () => {
    setIsModalOpen(false);
    setTimeout(() => setIsModalOpen(true), 100);
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
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-32">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Upgrader</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">High Risk, High Reward</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-3 sm:px-4 py-2 rounded-full border border-slate-700 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-bold text-slate-100 text-sm sm:text-base">{Number(user?.balance ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {realInventoryItems.length === 0 && !loading && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-sm">
            Your inventory has no available items to upgrade yet.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6">
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
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <UpgraderTargetPanel
                items={MOCK_TARGETS}
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
        disabled={realInventoryItems.length === 0}
      />

      <UpgraderResultModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        target={target}
        onRetry={handleRetry}
        chance={chance}
      />
    </div>
  );
}
