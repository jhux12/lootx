import React, { useMemo } from 'react';
import { Boxes, PackageCheck, ShieldCheck, Users } from 'lucide-react';
import { useGame } from '../context/GameContext';

export const HomeStatsBar: React.FC = () => {
  const { boxes, users } = useGame();
  const visibleCollectors = useMemo(
    () => users.filter((user) => user.hiddenFromPublicDisplay !== true).length,
    [users]
  );
  const liveBoxes = useMemo(
    () => boxes.filter((box) => !box.isUserCreated && !box.isPullPassBox).length,
    [boxes]
  );

  const stats = [
    { value: visibleCollectors ? visibleCollectors.toLocaleString() : 'Growing', label: 'Collectors', Icon: Users },
    { value: liveBoxes ? liveBoxes.toLocaleString() : 'Live', label: 'Boxes available', Icon: Boxes },
    { value: '100%', label: 'Verifiable pulls', Icon: ShieldCheck },
    { value: 'US + Intl', label: 'Tracked shipping', Icon: PackageCheck }
  ];

  return (
    <section className="px-3 sm:px-0" aria-label="LootX platform highlights">
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.07] bg-[#181c28] shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:grid-cols-4">
        {stats.map(({ value, label, Icon }, index) => (
          <div key={label} className={`flex min-h-[64px] items-center gap-3 px-3 py-2.5 sm:min-h-[72px] sm:px-4 ${index % 2 ? 'border-l border-white/[0.06]' : ''} ${index > 1 ? 'border-t border-white/[0.06] sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-white/[0.06]' : ''}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-violet-400/[0.08] text-violet-300">
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-sm font-bold text-white sm:text-base">{value}</strong>
              <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">{label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
