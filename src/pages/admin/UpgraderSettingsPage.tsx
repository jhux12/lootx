import React, { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, Calculator, ShieldCheck, Plus, Search, Trash2 } from 'lucide-react';
import { useGame } from '../../../context/GameContext';
import { getUpgraderSettings } from '../../../services/upgraderService';
import { deleteUpgraderTarget, listUpgraderTargetsAdmin, rotateServerSeed, saveUpgraderSettings, saveUpgraderTarget } from '../../../services/upgraderAdminService';
import { computeUpgradeChance, DEFAULT_UPGRADER_SETTINGS, normalizeUpgraderSettings, UpgraderSettings, UpgraderTarget } from '../../../utils/upgrader';
import { CaseItem } from '../../../types';

const toPercent = (value: number) => Number((value * 100).toFixed(2));
const fromPercent = (value: number) => Number((value / 100).toFixed(4));

const itemToTarget = (item: CaseItem): Partial<UpgraderTarget> => ({
  name: item.name,
  imageUrl: item.image,
  coinValue: Number(item.price ?? 0),
  rarity: item.rarity,
  category: item.category ?? 'General',
  enabled: true,
  weight: 1
});

export default function UpgraderSettingsPage() {
  const { items } = useGame();
  const [settings, setSettings] = useState<UpgraderSettings>(DEFAULT_UPGRADER_SETTINGS);
  const [previewSource, setPreviewSource] = useState('100');
  const [previewTarget, setPreviewTarget] = useState('200');
  const [targets, setTargets] = useState<UpgraderTarget[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    const [loadedSettings, loadedTargets] = await Promise.all([getUpgraderSettings(), listUpgraderTargetsAdmin()]);
    setSettings(normalizeUpgraderSettings(loadedSettings));
    setTargets(loadedTargets);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const existingNames = useMemo(
    () => new Set(targets.map((target) => target.name.trim().toLowerCase())),
    [targets]
  );

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    return items
      .filter((item) => !existingNames.has(item.name.trim().toLowerCase()))
      .filter((item) => !query || item.name.toLowerCase().includes(query) || (item.category ?? '').toLowerCase().includes(query))
      .sort((a, b) => a.price - b.price);
  }, [items, itemSearch, existingNames]);

  useEffect(() => {
    if (!selectedItemId && filteredItems.length > 0) {
      setSelectedItemId(filteredItems[0].id);
      return;
    }
    if (selectedItemId && !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0]?.id ?? '');
    }
  }, [filteredItems, selectedItemId]);

  const chancePreview = useMemo(() => {
    const sourceValue = Number(previewSource || 0);
    const targetValue = Number(previewTarget || 0);
    const chance = computeUpgradeChance({ sourceValue, targetValue, settings });
    return (chance * 100).toFixed(2);
  }, [previewSource, previewTarget, settings]);

  const updateSetting = <K extends keyof UpgraderSettings>(key: K, value: UpgraderSettings[K]) => {
    setSettings((prev) => normalizeUpgraderSettings({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveUpgraderSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateSeed = async () => {
    setIsSaving(true);
    try {
      await rotateServerSeed();
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = async () => {
    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem) return;
    await saveUpgraderTarget(itemToTarget(selectedItem));
    setItemSearch('');
    await loadData();
  };

  const handleDeleteTarget = async (targetId: string) => {
    await deleteUpgraderTarget(targetId);
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-200 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">Upgrader Settings</h1>
            <p className="text-slate-400">Configure global parameters and curate which items can be used as upgrade targets.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRotateSeed}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" /> Rotate Seed
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-indigo-500/20 bg-slate-900/50 p-5 xl:col-span-6">
            <div className="mb-5 flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-bold uppercase tracking-wider">Core Parameters</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                <span className="text-sm font-medium">Game Enabled</span>
                <button
                  onClick={() => updateSetting('enabled', !settings.enabled)}
                  className={`relative h-6 w-12 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${settings.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Edge Multiplier (House Edge)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.edgeMultiplier}
                  onChange={(e) => updateSetting('edgeMultiplier', Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Min Chance (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={toPercent(settings.minChance)}
                    onChange={(e) => updateSetting('minChance', fromPercent(Number(e.target.value) || 0))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Max Chance (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={toPercent(settings.maxChance)}
                    onChange={(e) => updateSetting('maxChance', fromPercent(Number(e.target.value) || 0))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Cooldown (ms)</label>
                <input
                  type="number"
                  value={settings.cooldownMs}
                  onChange={(e) => updateSetting('cooldownMs', Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:col-span-6">
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-900/20 p-5">
              <div className="mb-5 flex items-center gap-2 text-indigo-400">
                <Calculator className="h-5 w-5" />
                <h2 className="font-bold uppercase tracking-wider">Chance Preview Tool</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-indigo-300/60">Source Value</label>
                  <input
                    type="number"
                    value={previewSource}
                    onChange={(e) => setPreviewSource(e.target.value)}
                    className="w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-indigo-300/60">Target Value</label>
                  <input
                    type="number"
                    value={previewTarget}
                    onChange={(e) => setPreviewTarget(e.target.value)}
                    className="w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-6">
                <span className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-400">Resulting Chance</span>
                <span className="text-5xl font-black text-white">{chancePreview}%</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Permissions</h3>
              <div className="space-y-3">
                <label className="group flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.allowFromFreeBox}
                    onChange={(e) => updateSetting('allowFromFreeBox', e.target.checked)}
                    className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300 transition-colors group-hover:text-white">Allow items from Free Boxes</span>
                </label>
                <label className="group flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.allowFromPromo}
                    onChange={(e) => updateSetting('allowFromPromo', e.target.checked)}
                    className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300 transition-colors group-hover:text-white">Allow items from Promo Codes</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
          <h2 className="text-lg font-bold uppercase tracking-wide text-white">Available Upgrader Items</h2>
          <p className="mb-4 text-sm text-slate-400">Add catalog items to the upgrader target pool. Added items become selectable targets in the upgrader game.</p>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative lg:col-span-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search catalog items by name/category"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm lg:col-span-5"
            >
              {filteredItems.length === 0 && <option value="">No eligible catalog items</option>}
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · ${Number(item.price ?? 0).toFixed(2)}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddItem}
              disabled={!selectedItemId}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-2"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {targets.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">No upgrader targets configured yet.</div>
            )}
            {targets.map((target) => (
              <div key={target.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={target.imageUrl} alt={target.name} className="h-10 w-10 rounded-md object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{target.name}</p>
                    <p className="text-xs text-slate-400">{target.category} • {target.rarity} • ${Number(target.coinValue ?? 0).toFixed(2)}</p>
                  </div>
                </div>
                <button
                  onClick={() => void handleDeleteTarget(target.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
