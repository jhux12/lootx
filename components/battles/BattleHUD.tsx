import React from 'react';
import { ShieldCheck, SkipForward } from 'lucide-react';

export const BattleHUD: React.FC<{
  battle: any;
  currentRoundIndex: number;
  driverWarning: string | null;
  onSkip: () => void;
  onBack: () => void;
  onOpenFair: () => void;
}> = ({ battle, currentRoundIndex, driverWarning, onSkip, onBack, onOpenFair }) => (
  <div className="sticky top-[var(--pullz-header-height,72px)] z-30 mb-3 rounded-xl border border-white/10 bg-[#0b111b]/95 p-3 backdrop-blur">
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onBack} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300">Back</button>
      <div className="text-sm font-semibold text-white">Arena Battle • Round {currentRoundIndex + 1}/{Math.max(1, Number(battle?.roundCount ?? 1))}</div>
      <button onClick={onOpenFair} className="ml-auto rounded-lg border border-white/20 px-2 py-1.5 text-xs text-gray-300"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>Verify</button>
      <button onClick={onSkip} className="rounded-lg bg-brand-purple px-2.5 py-1.5 text-xs font-semibold text-white"><SkipForward className="mr-1 inline h-3.5 w-3.5"/>Skip</button>
    </div>
    {driverWarning && <div className="mt-2 text-xs text-amber-300">{driverWarning}</div>}
  </div>
);
