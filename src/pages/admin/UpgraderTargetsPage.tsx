import React, { useMemo, useState } from 'react';
import { MOCK_TARGETS } from '../../components/upgrader/upgraderMockData';
import { Item } from '../../components/upgrader/upgraderTypes';
import { Search, Save, Plus, Trash2 } from 'lucide-react';

export default function UpgraderTargetsPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[]>(MOCK_TARGETS);

  const filtered = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const toggleEnabled = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)));
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Upgrader Targets</h1>
            <p className="text-slate-400 text-sm">Manage available target items (mock data only).</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> Add Target
            </button>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search targets..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="max-h-[70vh] overflow-auto custom-scrollbar">
            <table className="w-full min-w-[760px]">
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
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/60">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <span className="font-semibold text-sm text-slate-200">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-300">{item.category}</td>
                    <td className="p-3 text-sm text-slate-300">{item.rarity}</td>
                    <td className="p-3 text-sm font-mono text-emerald-400">${item.coinValue.toFixed(2)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleEnabled(item.id)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${item.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.enabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
