import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useGame } from '../../../context/GameContext';
import { deleteUpgraderTarget, listUpgraderTargetsAdmin, saveUpgraderTarget } from '../../../services/upgraderAdminService';
import { UpgraderTarget } from '../../../utils/upgrader';
import { PRICE_UNIT_MODE, toCoins } from '../../../utils/coins';

export default function UpgraderTargetsPage() {
  const { items: siteItems } = useGame();
  const [search, setSearch] = useState('');
  const [targets, setTargets] = useState<UpgraderTarget[]>([]);
  const [selectedSiteItemId, setSelectedSiteItemId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadTargets = async () => {
    setLoading(true);
    try {
      const nextTargets = await listUpgraderTargetsAdmin();
      setTargets(nextTargets);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTargets();
  }, []);

  const filteredTargets = useMemo(
    () =>
      targets
        .filter((target) => {
          const query = search.toLowerCase();
          return (
            target.name.toLowerCase().includes(query) ||
            String(target.id).toLowerCase().includes(query) ||
            String(target.category ?? '').toLowerCase().includes(query)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [search, targets]
  );

  const selectableSiteItems = useMemo(() => {
    const existingIds = new Set(targets.map((target) => String(target.id)));
    return siteItems
      .filter((item) => !existingIds.has(String(item.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [siteItems, targets]);

  const saveMessage = (nextMessage: string) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const addTargetFromSiteItem = async () => {
    const trimmedId = selectedSiteItemId.trim();
    if (!trimmedId) return;

    const sourceItem = siteItems.find((item) => String(item.id) === trimmedId);
    if (!sourceItem) {
      saveMessage('Selected site item was not found.');
      return;
    }

    setSaving(true);
    try {
      await saveUpgraderTarget({
        id: String(sourceItem.id),
        name: sourceItem.name,
        imageUrl: sourceItem.image,
        coinValue: toCoins(Number(sourceItem.price ?? 0), PRICE_UNIT_MODE),
        rarity: String(sourceItem.rarity ?? 'common').toLowerCase(),
        category: sourceItem.category || 'General',
        enabled: true,
        weight: 1
      });
      setSelectedSiteItemId('');
      saveMessage('Target added from site items.');
      await loadTargets();
    } catch (error) {
      saveMessage(error instanceof Error ? error.message : 'Failed to save target.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (target: UpgraderTarget) => {
    setSaving(true);
    try {
      await saveUpgraderTarget({ ...target, enabled: !target.enabled });
      await loadTargets();
    } catch (error) {
      saveMessage(error instanceof Error ? error.message : 'Failed to update target.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTarget = async (id: string) => {
    setSaving(true);
    try {
      await deleteUpgraderTarget(id);
      saveMessage('Target removed.');
      await loadTargets();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Upgrader Targets</h1>
            <p className="text-slate-400 text-sm">Add and manage upgrader targets directly from your site items.</p>
          </div>
          <button
            onClick={() => void loadTargets()}
            disabled={loading || saving}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Add from Site Items</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedSiteItemId}
              onChange={(event) => setSelectedSiteItemId(event.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm"
            >
              <option value="">Select a site item…</option>
              {selectableSiteItems.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name} • {toCoins(Number(item.price ?? 0), PRICE_UNIT_MODE).toLocaleString()} coins
                </option>
              ))}
            </select>
            <button
              onClick={() => void addTargetFromSiteItem()}
              disabled={!selectedSiteItemId || saving}
              className="bg-[#205DD7] hover:bg-[#1f6bea] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Target
            </button>
          </div>
          <p className="text-xs text-slate-500">Only items not already in upgrader targets are shown here.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search targets by name, id, or category..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="max-h-[70vh] overflow-auto custom-scrollbar">
            <table className="w-full min-w-[700px]">
              <thead className="sticky top-0 bg-slate-900/95 border-b border-slate-800">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="p-3">Item</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Rarity</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Enabled</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredTargets.map((target) => (
                  <tr key={target.id} className="border-b border-slate-800/60">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={target.imageUrl} alt={target.name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-200 truncate">{target.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">ID: {target.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-300">{target.category || 'General'}</td>
                    <td className="p-3 text-sm text-slate-300 capitalize">{target.rarity}</td>
                    <td className="p-3 text-sm font-mono text-emerald-400">{Math.round(Number(target.coinValue ?? 0)).toLocaleString()} coins</td>
                    <td className="p-3">
                      <button
                        onClick={() => void toggleEnabled(target)}
                        disabled={saving}
                        className={`w-12 h-6 rounded-full relative transition-colors disabled:opacity-50 ${target.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${target.enabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => void deleteTarget(target.id)}
                        disabled={saving}
                        className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredTargets.length === 0 && (
                  <tr>
                    <td className="p-4 text-sm text-slate-500" colSpan={6}>No targets match your filters.</td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="p-4 text-sm text-slate-500" colSpan={6}>Loading upgrader targets…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
