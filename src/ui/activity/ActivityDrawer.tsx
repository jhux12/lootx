import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useActivity } from '../../lib/activity/useActivity';
import { ActivityItem } from './ActivityItem';
import { ProvablyFairModal } from '../provably/ProvablyFairModal';

export const ActivityDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { entries, markAllRead } = useActivity();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'buy' | 'open' | 'ship' | 'sell'>('all');
  const filteredEntries = filter === 'all' ? entries : entries.filter((entry) => entry.type === filter);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[160] bg-black/60" onClick={() => { markAllRead(); onClose(); }} />
      <aside className="fixed bottom-0 right-0 z-[165] h-[75vh] w-full rounded-t-2xl border border-white/10 bg-[#0d1118] p-4 sm:top-0 sm:h-full sm:max-w-md sm:rounded-none sm:border-l">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          <button type="button" onClick={() => { markAllRead(); onClose(); }} className="rounded-md border border-white/10 p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'buy', label: 'Top up' },
            { id: 'open', label: 'Unboxing' },
            { id: 'ship', label: 'Shipping' },
            { id: 'sell', label: 'Sells' }
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id as typeof filter)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${filter === option.id ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-300'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="max-h-[calc(75vh-120px)] space-y-2 overflow-y-auto pb-6 sm:max-h-[calc(100vh-120px)]">
          {filteredEntries.length === 0 ? <p className="text-sm text-gray-400">No entries for this filter yet.</p> : filteredEntries.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} onClick={() => setSelectedId(entry.id)} />
          ))}
        </div>
      </aside>
      <ProvablyFairModal
        isOpen={Boolean(selected && selected.type === 'open')}
        onClose={() => setSelectedId(null)}
        data={{ ...selected?.provablyFairData }}
      />
      {selected && selected.type !== 'open' ? (
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-4 text-sm text-gray-200">
            <p className="font-semibold text-white">{selected.title}</p>
            {typeof selected.value === 'number' ? <p className="mt-1 text-cyan-300">{selected.value.toLocaleString()} coins</p> : null}
            <button type="button" onClick={() => setSelectedId(null)} className="mt-3 rounded-lg border border-white/10 px-3 py-1.5">Close</button>
          </div>
        </div>
      ) : null}
    </>
  );
};
