import React from 'react';

export const RoundRecapOverlay: React.FC<{
  open: boolean;
  roundIndex: number;
  teamWinnerLabel: string;
}> = ({ open, roundIndex, teamWinnerLabel }) => (
  <div className={`pointer-events-none absolute left-1/2 top-2 z-20 w-[min(95%,720px)] -translate-x-1/2 transition ${open ? 'opacity-100' : 'opacity-0'}`}>
    <div className="rounded-xl border border-white/10 bg-[#0b111b]/95 p-2 text-center text-xs text-gray-200 backdrop-blur">
      Round {roundIndex + 1} recap • {teamWinnerLabel}
    </div>
  </div>
);
