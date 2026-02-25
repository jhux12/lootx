import React, { useState, useEffect } from 'react';
import { UpgraderSourcePanel } from '../components/upgrader/UpgraderSourcePanel';
import { UpgraderTargetPanel } from '../components/upgrader/UpgraderTargetPanel';
import { UpgraderPreviewBar } from '../components/upgrader/UpgraderPreviewBar';
import { UpgraderResultModal } from '../components/upgrader/UpgraderResultModal';
import { MOCK_INVENTORY, MOCK_TARGETS } from '../components/upgrader/upgraderMockData';
import { InventoryItem, Item } from '../components/upgrader/upgraderTypes';
import { Coins } from 'lucide-react';

export default function UpgraderPage() {
  const [source, setSource] = useState<InventoryItem | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
    // Keep target, maybe clear source if it was "consumed"
    // For shell, we just close and reopen
    setTimeout(() => setIsModalOpen(true), 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-32">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Upgrader</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">High Risk, High Reward</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-bold text-slate-100">1,240.50</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Source */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <UpgraderSourcePanel 
                items={MOCK_INVENTORY} 
                selectedId={source?.id || null}
                onSelect={setSource}
                loading={loading}
              />
            </div>
          </div>

          {/* Center: Arrow for desktop */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>

          {/* Right Column: Target */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
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
