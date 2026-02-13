import React, { useCallback, useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { useBoxes, useUI } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BoxCard } from './BoxCard';
import { MysteryBox } from '../types';
import { getPackType } from '../utils/packs';

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
  title = 'Popular Packs',
  boxes: boxesOverride,
  viewAllQuery,
  viewAllLabel = 'View all',
  initialVisibleCount = 4,
  perPage = 4
}) => {
  const { boxes: allBoxes } = useBoxes();
  const { setView } = useUI();
  const { playSound } = useSound();
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  const displayBoxes = useMemo(() => {
    const base = (boxesOverride ?? allBoxes).filter((box) => !box.isUserCreated && !box.isDaily);
    const map = new Map<string, MysteryBox>();
    base.forEach((box) => {
      const key = getPackType(box);
      const existing = map.get(key);
      if (!existing || box.price < existing.price) {
        map.set(key, box);
      }
    });
    return Array.from(map.values());
  },
    [allBoxes, boxesOverride]
  );
  const visibleBoxes = useMemo(() => displayBoxes.slice(0, visibleCount), [displayBoxes, visibleCount]);
  const canViewMore = visibleCount < displayBoxes.length;

  const handleViewAll = useCallback(() => {
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
  }, [playSound, setView, viewAllQuery]);

  const handleSelectBox = useCallback((boxId: string) => {
    playSound('click');
    setView({ type: 'CASE_OPENING', boxId });
  }, [playSound, setView]);

  const handleViewMore = useCallback(() => {
    playSound('click');
    setVisibleCount((count) => Math.min(count + perPage, displayBoxes.length));
  }, [displayBoxes.length, perPage, playSound]);

  const hoverProps = useMemo(() => ({ onHover: () => playSound('hover') }), [playSound]);

  return (
    <section id="popular-boxes" className="px-4 md:px-0 scroll-mt-32">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4 sm:mb-3">
        <div className="flex items-center gap-2 text-left">
          <Boxes className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <button className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white" onClick={handleViewAll}>
          {viewAllLabel}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleBoxes.map((box) => (
          <BoxCard key={box.id} box={box} onSelect={handleSelectBox} {...hoverProps} />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        {canViewMore && (
          <button className="min-h-11 px-6 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white" onClick={handleViewMore}>
            View more
          </button>
        )}
      </div>
    </section>
  );
};
