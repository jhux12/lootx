import React from 'react';
import { DeterministicReel, DeterministicReelItem } from './DeterministicReel';

export const PlayerCard: React.FC<{
  player: any;
  spinKey: string;
  winningItem: DeterministicReelItem | null;
  fillerPool: DeterministicReelItem[];
  reelPhase: 'IDLE' | 'SPIN' | 'STOPPED';
  spinMs: number;
  roundLabel: string;
  showReveal: boolean;
}> = ({ player, spinKey, winningItem, fillerPool, reelPhase, spinMs, roundLabel, showReveal }) => (
  <div className="rounded-xl border border-white/10 bg-[#0c1320] p-2 sm:p-3">
    <div className="mb-2 flex items-center gap-2">
      <img src={player.avatar || 'https://placehold.co/40x40'} className="h-8 w-8 rounded-full border border-white/20 object-cover" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{player.displayName}</div>
      </div>
    </div>
    <DeterministicReel spinKey={spinKey} winningItem={winningItem} fillerPool={fillerPool} phase={reelPhase} durationMs={spinMs} />
    <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
      <div className="text-gray-400">{roundLabel}</div>
      {showReveal && winningItem ? <div className="truncate font-semibold text-white">{winningItem.name} • {winningItem.value.toLocaleString()}</div> : <div className="text-gray-500">Waiting...</div>}
    </div>
  </div>
);
