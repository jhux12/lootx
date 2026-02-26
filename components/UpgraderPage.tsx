import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { attemptUpgrade, getUpgraderSettings, getUpgraderTargets } from '../services/upgraderService';
import { ChancePreview } from './upgrader/ChancePreview';
import { SourceInventoryPicker } from './upgrader/SourceInventoryPicker';
import { TargetPicker } from './upgrader/TargetPicker';
import { UpgradeResultModal } from './upgrader/UpgradeResultModal';
import { UpgradeSpinWheel } from './upgrader/UpgradeSpinWheel';
import { computeUpgradeChance, getItemCoinValue, UpgraderSettings, UpgraderTarget } from '../utils/upgrader';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const waitForNextPaint = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));

export const UpgraderPage: React.FC = () => {
  const { inventory, isAuthenticated, openAuthModal } = useGame();
  const { muted, toggleMute, playSound } = useSound();
  const [settings, setSettings] = useState<UpgraderSettings | null>(null);
  const [targets, setTargets] = useState<UpgraderTarget[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [spinPhase, setSpinPhase] = useState<'idle' | 'settling'>('idle');
  const [wheelRotation, setWheelRotation] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | { win: boolean; roll: number; chance: number; awardedItem?: { name: string; imageUrl: string } }>(null);
  const [filters, setFilters] = useState({ rarity: '', category: '', min: 0, max: 0, sort: 'asc' as 'asc' | 'desc' });
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [nextSettings, nextTargets] = await Promise.all([getUpgraderSettings(), getUpgraderTargets()]);
      setSettings(nextSettings);
      setTargets(nextTargets);
    })();
  }, []);

  const availableInventory = useMemo(
    () => inventory.filter((item) => (item.status ?? 'available') === 'available' && !item.locked),
    [inventory]
  );
  const sourceItem = availableInventory.find((item) => item.instanceId === selectedSourceId);
  const targetItem = targets.find((target) => target.id === selectedTargetId);

  const chance = useMemo(() => {
    if (!settings || !sourceItem || !targetItem) return 0;
    return computeUpgradeChance({
      sourceValue: getItemCoinValue(sourceItem),
      targetValue: targetItem.coinValue,
      settings,
      isSameRarity: sourceItem.rarity === targetItem.rarity
    });
  }, [settings, sourceItem, targetItem]);

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
      playSound('upgrader-spin');
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

  const handleCopyPageLink = async () => {
    if (typeof window === 'undefined') return;
    const pageUrl = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pageUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = pageUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyStatusMessage('Link copied');
    } catch {
      setCopyStatusMessage('Copy failed');
    } finally {
      window.setTimeout(() => setCopyStatusMessage(null), 1800);
    }
  };

  if (!isAuthenticated) {
    return <div className="mx-auto max-w-2xl p-6 text-center"><h1 className="text-2xl font-bold text-white">Upgrader</h1><p className="mt-2 text-gray-400">Sign in to use upgrades.</p><button onClick={() => openAuthModal('login')} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Sign in</button></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-6">
      <h1 className="text-2xl font-black text-white sm:text-3xl">Upgrader</h1>
      <p className="mb-4 text-sm text-gray-400">Risk one item to upgrade into a higher-value target.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SourceInventoryPicker items={availableInventory} selectedId={selectedSourceId} onSelect={setSelectedSourceId} />
        <TargetPicker targets={targets} selectedId={selectedTargetId} onSelect={setSelectedTargetId} filters={filters} onFilterChange={setFilters} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-white/10 bg-black/35 p-2">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                if (typeof window !== 'undefined') window.location.assign('/provably-fair#verify');
              }}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/60 text-emerald-300 transition hover:border-emerald-300/60 hover:text-emerald-200"
              aria-label="Open provably fair details"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                playSound('click');
                void handleCopyPageLink();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/60 text-gray-200 transition hover:border-cyan-300/60 hover:text-cyan-200"
              aria-label="Copy page link"
            >
              <Copy className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                playSound('click');
                toggleMute();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/60 text-gray-200 transition hover:border-violet-300/60 hover:text-violet-200"
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          {copyStatusMessage && (
            <p className="text-right text-xs text-cyan-200" role="status" aria-live="polite">
              {copyStatusMessage}
            </p>
          )}
          <UpgradeSpinWheel chance={chance} phase={spinPhase} rotationDeg={wheelRotation} target={targetItem} />
        </div>
        <ChancePreview chance={chance} sourceName={sourceItem?.name} targetName={targetItem?.name} />
        <button disabled={isDisabled} onClick={onAttempt} title={isCooldown ? 'Cooldown active' : ''} className="h-14 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-8 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-50 xl:col-span-2">
          {isSubmitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Calculating result…</span> : 'Upgrade Now'}
        </button>
      </div>
      {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</div>}
      <UpgradeResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
};
