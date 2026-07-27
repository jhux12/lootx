import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { MysteryBox } from '../types';
import { BoxCard } from './BoxCard';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type BoxRowQuery = {
  tags?: string[];
  maxPrice?: number;
  minPrice?: number;
};

type BoxRowProps = {
  title: string;
  boxes: MysteryBox[];
  viewAllQuery?: BoxRowQuery;
};

export const BoxRow: React.FC<BoxRowProps> = ({ title, boxes, viewAllQuery }) => {
  const { setView } = useGame();
  const { playSound } = useSound();

  if (boxes.length === 0) return null;

  const handleViewAll = () => {
    playSound('click');
    if (viewAllQuery) {
      const params = new URLSearchParams();
      if (viewAllQuery.tags?.length) params.set('tags', viewAllQuery.tags.join(','));
      if (typeof viewAllQuery.minPrice === 'number') params.set('minPrice', String(viewAllQuery.minPrice));
      if (typeof viewAllQuery.maxPrice === 'number') params.set('maxPrice', String(viewAllQuery.maxPrice));
      const search = params.toString();
      window.history.replaceState({}, '', `/boxes${search ? `?${search}` : ''}`);
    }
    setView({ type: 'BOXES' });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={handleViewAll}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 transition hover:text-white"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-10 bg-gradient-to-r from-[#050811] via-[#050811]/80 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-10 bg-gradient-to-l from-[#050811] via-[#050811]/80 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#050811] via-[#050811]/90 to-transparent sm:hidden" />
        <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:pb-0">
          {boxes.map((box) => (
            <div key={box.id} className="min-w-[240px] snap-start sm:min-w-0">
              <BoxCard
                box={box}
                onSelect={(boxId) => {
                  playSound('click');
                  setView({ type: 'CASE_OPENING', boxId });
                }}
                onHover={() => playSound('hover')}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
