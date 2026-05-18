import React, { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, Calculator, ShieldCheck, Plus, X } from 'lucide-react';
import { useGame } from '../../../context/GameContext';
import { rotateServerSeed, saveUpgraderSettings } from '../../../services/upgraderAdminService';
import { getUpgraderSettings } from '../../../services/upgraderService';
import { computeExpectedPayout, computeUpgradeChance, getProfitabilitySafety, UpgraderSettings, validateUpgraderSettings } from '../../../utils/upgrader';

export default function UpgraderSettingsPage() {
  const { items } = useGame();
  const [settings, setSettings] = useState<UpgraderSettings | null>(null);
  const [previewSource, setPreviewSource] = useState('100');
  const [previewTarget, setPreviewTarget] = useState('200');
  const [sourceItemDraft, setSourceItemDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const next = await getUpgraderSettings();
      setSettings(next);
    })();
  }, []);

  const itemOptions = useMemo(
    () => items.map((item) => ({ id: String(item.id), label: `${item.name} (${item.id})` })),
    [items]
  );

  const previewMetrics = useMemo(() => {
    if (!settings) {
      return {
        chancePercent: '0.0000',
        expectedPayout: '0.00',
        effectiveRtp: '0.00',
        effectiveEdge: '100.00',
        wasClamped: false
      };
    }

    const sourceValue = parseFloat(previewSource) || 0;
    const targetValue = parseFloat(previewTarget) || 0;
    const chance = computeUpgradeChance({
      sourceValue,
      targetValue,
      settings,
      isSameRarity: true,
      vipMultiplier: settings.vipBonusEnabled ? 2 : 1
    });
    const expectedPayout = computeExpectedPayout({ chance, targetValue });
    const safety = getProfitabilitySafety({
      chance,
      sourceValue,
      targetValue,
      maxExpectedPayoutRatio: settings.maxExpectedPayoutRatio
    });

    return {
      chancePercent: (chance * 100).toFixed(4),
      expectedPayout: expectedPayout.toFixed(2),
      effectiveRtp: ((sourceValue > 0 ? expectedPayout / sourceValue : 0) * 100).toFixed(2),
      effectiveEdge: (100 - ((sourceValue > 0 ? expectedPayout / sourceValue : 0) * 100)).toFixed(2),
      wasClamped: safety.wasClamped
    };
  }, [previewSource, previewTarget, settings]);

  const settingsValidation = useMemo(() => (settings ? validateUpgraderSettings(settings) : null), [settings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveUpgraderSettings(settings);
      setMessage('Settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRotateSeed = async () => {
    setSaving(true);
    try {
      const hash = await rotateServerSeed();
      setSettings((prev) => (prev ? { ...prev, serverSeedHash: hash } : prev));
      setMessage('Server seed hash rotated.');
    } finally {
      setSaving(false);
    }
  };

  const addAllowedSourceItem = () => {
    if (!settings) return;
    const trimmed = sourceItemDraft.trim();
    if (!trimmed) return;

    setSettings((prev) => {
      if (!prev) return prev;
      const nextIds = Array.from(new Set([...(prev.sourceItemIdsEnabled ?? []), trimmed]));
      return { ...prev, sourceItemIdsEnabled: nextIds };
    });
    setSourceItemDraft('');
  };

  const removeAllowedSourceItem = (id: string) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sourceItemIdsEnabled: (prev.sourceItemIdsEnabled ?? []).filter((entry) => entry !== id)
      };
    });
  };

  if (!settings) {
    return <div className="min-h-screen bg-slate-950 text-slate-300 p-6">Loading upgrader settings…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Upgrader Settings</h1>
            <p className="text-slate-400 text-sm sm:text-base">Configure live parameters and source-item availability for the upgrader.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRotateSeed}
              disabled={saving}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Rotate Seed
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#205DD7] hover:bg-[#1f6bea] text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save Settings
            </button>
          </div>
        </div>

        {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}
        {settingsValidation && !settingsValidation.ok && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {settingsValidation.issues.join(' ')}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="font-bold uppercase tracking-wider">Core Parameters</h2>
            </div>

            <label className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800">
              <span className="text-sm font-medium">Game Enabled</span>
              <button
                onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enabled ? 'left-7' : 'left-1'}`} />
              </button>
            </label>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Edge Multiplier (%)</label>
              <input
                type="number"
                step="1"
                value={((settings.edgeMultiplier ?? 0.92) * 100).toFixed(0)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    edgeMultiplier: Number(e.target.value || 0) / 100
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Max Expected Payout Ratio (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={(settings.maxExpectedPayoutRatio * 100).toFixed(2)}
                onChange={(e) => setSettings({ ...settings, maxExpectedPayoutRatio: Number(e.target.value || 0) / 100 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Min Chance (%)</label>
                <input type="number" step="0.0001" min="0.0001" value={(settings.minChance * 100).toFixed(4)} onChange={(e) => setSettings({ ...settings, minChance: Number(e.target.value || 0) / 100 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Max Chance (%)</label>
                <input type="number" step="0.01" value={(settings.maxChance * 100).toFixed(2)} onChange={(e) => setSettings({ ...settings, maxChance: Number(e.target.value || 0) / 100 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Minimum Upgrade Ratio</label>
              <input type="number" step="0.01" value={settings.minUpgradeRatio} onChange={(e) => setSettings({ ...settings, minUpgradeRatio: Number(e.target.value || 1) })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Cooldown (ms)</label>
              <input type="number" value={settings.cooldownMs} onChange={(e) => setSettings({ ...settings, cooldownMs: Number(e.target.value || 0) })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 sm:p-6 space-y-5">
              <div className="flex items-center gap-2 text-blue-400">
                <Calculator className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-wider">Chance Preview</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={previewSource} onChange={(e) => setPreviewSource(e.target.value)} className="w-full bg-slate-950/50 border border-blue-500/20 rounded-lg px-4 py-2 text-sm" />
                <input type="number" value={previewTarget} onChange={(e) => setPreviewTarget(e.target.value)} className="w-full bg-slate-950/50 border border-blue-500/20 rounded-lg px-4 py-2 text-sm" />
              </div>
              <div className="p-4 sm:p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-center space-y-3">
                <div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Resulting Chance</span>
                  <div className="text-3xl sm:text-4xl font-black text-white">{previewMetrics.chancePercent}%</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/40 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">Expected Payout</p>
                    <p className="text-lg font-bold text-white">{previewMetrics.expectedPayout}</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/40 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">Effective RTP</p>
                    <p className="text-lg font-bold text-emerald-300">{previewMetrics.effectiveRtp}%</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/40 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">House Edge</p>
                    <p className="text-lg font-bold text-amber-300">{previewMetrics.effectiveEdge}%</p>
                  </div>
                </div>
                {previewMetrics.wasClamped && (
                  <p className="text-xs text-amber-300">Chance is being clamped by the expected value ceiling after VIP/promo/same-rarity modifiers.</p>
                )}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Allowed Source Items (Optional)</h3>
              <p className="text-xs text-slate-500">If this list has entries, only these item IDs can be used as the source in upgrader.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  list="upgrader-source-item-options"
                  value={sourceItemDraft}
                  onChange={(e) => setSourceItemDraft(e.target.value)}
                  placeholder="Enter item id"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm"
                />
                <datalist id="upgrader-source-item-options">
                  {itemOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </datalist>
                <button onClick={addAllowedSourceItem} className="bg-[#205DD7] hover:bg-[#1f6bea] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(settings.sourceItemIdsEnabled ?? []).map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                    {id}
                    <button onClick={() => removeAllowedSourceItem(id)} className="text-slate-400 hover:text-white"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {(settings.sourceItemIdsEnabled ?? []).length === 0 && <span className="text-xs text-slate-500">No source whitelist configured.</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
