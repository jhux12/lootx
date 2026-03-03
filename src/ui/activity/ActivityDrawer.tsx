import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useActivity } from '../../lib/activity/useActivity';
import { ActivityItem } from './ActivityItem';
import { ProvablyFairModal } from '../provably/ProvablyFairModal';

export const ActivityDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { entries, markAllRead } = useActivity();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        <div className="space-y-2 overflow-y-auto pb-6">
          {entries.length === 0 ? <p className="text-sm text-gray-400">Your activity will appear here.</p> : entries.map((entry) => (
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
