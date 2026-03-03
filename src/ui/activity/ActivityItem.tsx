import React from 'react';
import { ActivityEntry } from '../../lib/activity/types';
import { ActivityBadge } from './ActivityBadge';

export const ActivityItem: React.FC<{ entry: ActivityEntry; onClick: () => void }> = ({ entry, onClick }) => (
  <div className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
    <div className="mb-1 flex items-center justify-between gap-2">
      <ActivityBadge type={entry.type} />
      <span className="text-[11px] text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
    </div>
    <p className="text-sm font-medium text-white">{entry.title}</p>
    {typeof entry.value === 'number' ? <p className="text-xs text-cyan-300">{entry.value.toLocaleString()} coins</p> : null}
    <div className="mt-1 flex items-center justify-between">
      <button type="button" onClick={onClick} className="text-xs text-gray-300 underline">View receipt</button>
      {entry.type === 'open' ? <button type="button" onClick={onClick} className="text-xs text-cyan-300 underline">Verify</button> : null}
    </div>
  </div>
);
