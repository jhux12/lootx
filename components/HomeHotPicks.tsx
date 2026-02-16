import React, { useMemo } from 'react';
import type { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { getBoxTags } from '../utils/boxTags';

type HomeHotPicksProps = {
  boxes: MysteryBox[];
  onSelectBox: (boxId: string) => void;
};

export const HomeHotPicks: React.FC<HomeHotPicksProps> = ({ boxes, onSelectBox }) => {
  const picks = useMemo(() => {
    const officialBoxes = boxes.filter((box) => !box.isDaily && !box.isUserCreated);
    const featured = officialBoxes.filter((box) => {
      const tags = getBoxTags(box);
      return tags.includes('featured') || tags.includes('hot') || tags.includes('trending');
    });

    const source = featured.length >= 5 ? featured : officialBoxes;
    return [...source]
      .sort((a, b) => b.price - a.price)
      .slice(0, 6);
  }, [boxes]);

  if (!picks.length) return null;

  return (
    <section className="space-y-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200/70">Featured</p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Hot Picks</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((box) => (
          <button
            key={box.id}
            type="button"
            onClick={() => onSelectBox(box.id)}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] px-4 pb-5 pt-8 text-center shadow-[0_10px_30px_rgba(4,6,15,0.4)] transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="pointer-events-none absolute inset-x-8 bottom-10 h-6 rounded-full bg-violet-500/30 blur-xl" />
            <div className="relative mx-auto flex h-36 w-full items-end justify-center sm:h-44">
              <img src={box.image} alt={box.name} className="relative z-10 h-28 object-contain drop-shadow-[0_14px_25px_rgba(0,0,0,0.45)] sm:h-36" loading="lazy" />
              <div className="absolute bottom-1 h-5 w-4/5 rounded-full border border-white/10 bg-gradient-to-b from-slate-200/20 to-slate-400/10" />
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0d1322]/90 px-4 py-2">
              <span className="max-w-[160px] truncate text-sm font-semibold text-white">{box.name}</span>
              <span className="h-4 w-px bg-white/15" />
              <CoinAmount amount={box.price} className="text-xs text-violet-200" iconClassName="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
