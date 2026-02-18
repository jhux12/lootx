import React, { useMemo } from 'react';
import { Gamepad2 } from 'lucide-react';
import { MysteryBox } from '../types';

type TopDropsSliderProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string) => void;
  className?: string;
};

type SliderDropItem = {
  sourceBoxId: string;
  sourceKey: string;
  image: string;
  name: string;
  value: number;
};

export const TopDropsSlider: React.FC<TopDropsSliderProps> = ({ boxes, onOpenBox, className = '' }) => {
  const topDropItems = useMemo<SliderDropItem[]>(
    () =>
      boxes
        .filter((box) => !box.isUserCreated)
        .flatMap((box) =>
          box.items
            .filter((item) => item.rarity === 'legendary')
            .map((item) => ({
              sourceBoxId: box.id,
              sourceKey: `${box.id}-${item.id ?? item.name}`,
              image: item.image,
              name: item.name,
              value: item.value
            }))
        )
        .sort((a, b) => b.value - a.value)
        .slice(0, 20),
    [boxes]
  );

  if (topDropItems.length === 0) return null;

  return (
    <div className={`relative flex w-full ${className}`}>
      <div className="mr-0.5 flex shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-l-lg border-r border-solid border-r-indigo-500 bg-neutral-800/40 bg-[radial-gradient(ellipse_at_right,rgba(99,102,241,0.25),rgba(99,102,241,0.12)_40%,rgba(99,102,241,0.06)_60%,transparent_85%)]">
        <div className="flex h-full w-[72px] flex-col items-center justify-center gap-1.5 bg-[radial-gradient(ellipse_80%_100%_at_100%_50%,rgba(99,102,241,0.2),transparent_60%)] px-3 py-2 sm:w-[80px] sm:px-4">
          <Gamepad2 className="h-4 w-4 text-indigo-400 sm:h-5 sm:w-5" />
          <div className="text-center text-[10px] font-bold leading-none text-white sm:text-[11px]">TOP<br />DROPS</div>
        </div>
      </div>
      <div className="relative h-[84px] w-full overflow-hidden rounded-r-lg border border-white/5 bg-neutral-900/30 p-0 mask-linear-fade sm:h-[92px]">
        <div className="ticker-animation absolute top-0 flex h-full items-center gap-2 pl-3 sm:pl-4">
          {[...topDropItems, ...topDropItems].map((item, i) => (
            <button
              key={`${item.sourceKey}-${i}`}
              className="flex h-[64px] w-[64px] items-center justify-center rounded-md border-b-2 border-amber-400/60 bg-neutral-800/80 p-2 transition hover:border-amber-300 sm:h-[70px] sm:w-[70px]"
              onClick={() => onOpenBox(item.sourceBoxId)}
              type="button"
              title={item.name}
            >
              <img src={item.image} className="h-full w-full object-contain" alt={item.name} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
