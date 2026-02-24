import React, { useEffect, useMemo, useState } from 'react';
import { deleteUpgraderTarget, listUpgraderTargetsAdmin, rotateServerSeed, saveUpgraderSettings, saveUpgraderTarget } from '../../services/upgraderAdminService';
import { computeUpgradeChance, DEFAULT_UPGRADER_SETTINGS, normalizeUpgraderSettings, UpgraderSettings, UpgraderTarget } from '../../utils/upgrader';

export const UpgraderAdminSection: React.FC = () => {
  const [settingsDraft, setSettingsDraft] = useState<UpgraderSettings>(DEFAULT_UPGRADER_SETTINGS);
  const [targets, setTargets] = useState<UpgraderTarget[]>([]);
  const [targetDraft, setTargetDraft] = useState<Partial<UpgraderTarget>>({ enabled: true, weight: 1 });
  const [previewSource, setPreviewSource] = useState(100);
  const [previewTarget, setPreviewTarget] = useState(150);
  const previewChance = useMemo(() => computeUpgradeChance({ sourceValue: previewSource, targetValue: previewTarget, settings: settingsDraft }), [previewSource, previewTarget, settingsDraft]);

  const reloadTargets = async () => {
    const next = await listUpgraderTargetsAdmin();
    setTargets(next);
  };

  useEffect(() => {
    void reloadTargets();
  }, []);

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#091521] p-4 sm:p-6">
      <h3 className="text-lg font-bold text-white">Upgrader Settings</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['edgeMultiplier', 'Edge Multiplier'],
          ['minChance', 'Min Chance'],
          ['maxChance', 'Max Chance'],
          ['minUpgradeRatio', 'Min Upgrade Ratio'],
          ['cooldownMs', 'Cooldown (ms)'],
          ['maxTargetValue', 'Max Target Value']
        ].map(([key, label]) => (
          <label key={key} className="text-xs text-gray-400">{label}
            <input type="number" value={Number((settingsDraft as any)[key] ?? 0)} onChange={(e) => setSettingsDraft((prev) => normalizeUpgraderSettings({ ...prev, [key]: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setSettingsDraft((prev) => ({ ...prev, enabled: !prev.enabled }))} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white">{settingsDraft.enabled ? 'Disable' : 'Enable'} Upgrader</button>
        <button onClick={() => { void saveUpgraderSettings(settingsDraft); }} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">Save Settings</button>
        <button onClick={() => { void rotateServerSeed(); }} className="rounded-lg border border-cyan-500/50 px-3 py-2 text-xs text-cyan-300">Rotate Server Seed</button>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-[#0b0e14] p-3">
        <div className="text-xs text-gray-400">Preview chance tool</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
          <input type="number" value={previewSource} onChange={(e) => setPreviewSource(Number(e.target.value || 0))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white" />
          <input type="number" value={previewTarget} onChange={(e) => setPreviewTarget(Number(e.target.value || 0))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="mt-2 text-sm font-bold text-emerald-300">Chance: {(previewChance * 100).toFixed(2)}%</div>
      </div>

      <h4 className="mt-6 text-base font-bold text-white">Upgrader Prize Pool</h4>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input placeholder="Name" value={targetDraft.name ?? ''} onChange={(e) => setTargetDraft((prev) => ({ ...prev, name: e.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input placeholder="Image URL" value={targetDraft.imageUrl ?? ''} onChange={(e) => setTargetDraft((prev) => ({ ...prev, imageUrl: e.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input type="number" placeholder="Coin value" value={targetDraft.coinValue ?? ''} onChange={(e) => setTargetDraft((prev) => ({ ...prev, coinValue: Number(e.target.value || 0) }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input placeholder="Rarity" value={targetDraft.rarity ?? ''} onChange={(e) => setTargetDraft((prev) => ({ ...prev, rarity: e.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={async () => { await saveUpgraderTarget(targetDraft); setTargetDraft({ enabled: true, weight: 1 }); await reloadTargets(); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Add Target</button>
      </div>
      <div className="mt-3 space-y-2">
        {targets.map((target) => (
          <div key={target.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0b0e14] p-2 text-xs text-gray-200">
            <span>{target.name} · {target.coinValue}</span>
            <button onClick={async () => { await deleteUpgraderTarget(target.id); await reloadTargets(); }} className="rounded border border-rose-500/40 px-2 py-1 text-rose-300">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
};
