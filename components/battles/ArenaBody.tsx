import React from 'react';
import { PlayerCard } from './PlayerCard';
import { RoundDots } from './RoundDots';
import { ValueBar } from './ValueBar';

export const ArenaBody: React.FC<any> = ({
  teamA,
  teamB,
  getWinningItem,
  spinKeysByUid,
  fillerPool,
  reelPhase,
  spinMs,
  currentRoundIndex,
  animatedRounds,
  totals,
  battle
}) => (
  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1422] to-[#090f18] p-2 sm:p-4">
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
      <div className="space-y-2">{teamA.map((p: any) => <PlayerCard key={p.uid} player={p} spinKey={spinKeysByUid[p.uid] ?? `idle-${p.uid}`} winningItem={getWinningItem(p.uid)} fillerPool={fillerPool} reelPhase={reelPhase} spinMs={spinMs} roundLabel={`Round ${currentRoundIndex + 1} result`} showReveal={animatedRounds.has(currentRoundIndex)} />)}</div>
      <div className="flex flex-col items-center justify-center gap-2 py-2"><div className="text-2xl font-black text-white">VS</div><RoundDots count={Math.max(1, Number(battle?.roundCount ?? 1))} current={currentRoundIndex} animatedRounds={animatedRounds} /></div>
      <div className="space-y-2">{teamB.map((p: any) => <PlayerCard key={p.uid} player={p} spinKey={spinKeysByUid[p.uid] ?? `idle-${p.uid}`} winningItem={getWinningItem(p.uid)} fillerPool={fillerPool} reelPhase={reelPhase} spinMs={spinMs} roundLabel={`Round ${currentRoundIndex + 1} result`} showReveal={animatedRounds.has(currentRoundIndex)} />)}</div>
    </div>
    <div className="mt-3"><ValueBar a={totals.A} b={totals.B} crazyMode={String(battle?.mode).toLowerCase().includes('crazy')} /></div>
  </div>
);
