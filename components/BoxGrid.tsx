import React, { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BoxCard } from './BoxCard';
import { MysteryBox } from '../types';
import { RiskLegend } from './RiskLegend';

type BoxGridQuery = {
  tags?: string[];
  maxPrice?: number;
  minPrice?: number;
};

type BoxGridProps = {
  title?: string;
  boxes?: MysteryBox[];
  viewAllQuery?: BoxGridQuery;
  viewAllLabel?: string;
  initialVisibleCount?: number;
  perPage?: number;
};

export const BoxGrid: React.FC<BoxGridProps> = ({
  title = 'Popular Mystery Boxes',
  boxes: boxesOverride,
  viewAllQuery,
  viewAllLabel = 'View all',
  initialVisibleCount = 4,
  perPage = 4
}) => {
  const { setView, boxes: allBoxes } = useGame();
  const { playSound } = useSound();
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  // Filter out user-created and daily free boxes from the main shop/grid
  const displayBoxes = useMemo(
    () => (boxesOverride ?? allBoxes).filter(box => !box.isUserCreated && !box.isDaily),
    [allBoxes, boxesOverride]
  );
  const visibleBoxes = displayBoxes.slice(0, visibleCount);
  const canViewMore = visibleCount < displayBoxes.length;
  return (
    <section id="popular-boxes" className="px-4 md:px-0 scroll-mt-32">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 text-left">
          <Boxes className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <button
          className="w-full sm:w-auto px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
          onClick={() => {
            playSound('click');
            setView({ type: 'BOXES' });
            if (viewAllQuery) {
              const params = new URLSearchParams();
              if (viewAllQuery.tags?.length) params.set('tags', viewAllQuery.tags.join(','));
              if (typeof viewAllQuery.minPrice === 'number') params.set('minPrice', String(viewAllQuery.minPrice));
              if (typeof viewAllQuery.maxPrice === 'number') params.set('maxPrice', String(viewAllQuery.maxPrice));
              const search = params.toString();
              window.history.replaceState({}, '', `/boxes${search ? `?${search}` : ''}`);
            }
          }}
        >
          {viewAllLabel}
        </button>
      </div>
      <div className="mb-6 flex w-full justify-center sm:justify-end">
        <RiskLegend className="justify-center sm:justify-end" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleBoxes.map((box) => (
          <BoxCard
            key={box.id}
            box={box}
            onSelect={(boxId) => {
              playSound('click');
              setView({ type: 'CASE_OPENING', boxId });
            }}
            onHover={() => playSound('hover')}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        {canViewMore && (
          <button
            className="px-6 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
            onClick={() => {
              playSound('click');
              setVisibleCount((count) => Math.min(count + perPage, displayBoxes.length));
            }}
          >
            View more
          </button>
        )}
      </div>
    </section>
  );
};
