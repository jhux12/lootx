import React, { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import caselabImage from '../assets/caselab.gif';
import { BoxCard } from './BoxCard';

export const BoxGrid: React.FC = () => {
  const { setView, boxes } = useGame();
  const { playSound } = useSound();
  const [visibleCount, setVisibleCount] = useState(4);
  const perPage = 4;

  // Filter out user-created and daily free boxes from the main shop/grid
  const displayBoxes = useMemo(
    () => boxes.filter(box => !box.isUserCreated && !box.isDaily),
    [boxes]
  );
  const visibleBoxes = displayBoxes.slice(0, visibleCount);
  const canViewMore = visibleCount < displayBoxes.length;
  return (
    <section className="mt-12 px-4 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Boxes className="w-5 h-5 text-sky-400" /> Popular Mystery Boxes
        </h3>
        <button
          className="w-full sm:w-auto px-4 py-2 bg-brand-card hover:bg-gray-700 rounded-lg text-sm font-bold text-gray-300 transition-colors"
          onClick={() => {
            playSound('click');
            setView({ type: 'BOXES' });
          }}
        >
          View all
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
      <div className="mt-6 flex flex-wrap gap-2">
        {canViewMore && (
          <button
            className="px-4 py-2 bg-brand-card hover:bg-gray-700 rounded-lg text-sm font-bold text-gray-300 transition-colors"
            onClick={() => {
              playSound('click');
              setVisibleCount((count) => Math.min(count + perPage, displayBoxes.length));
            }}
          >
            View more
          </button>
        )}
      </div>
      <div className="mt-6 w-full">
        <button
          type="button"
          onClick={() => {
            playSound('click');
            setView({ type: 'CUSTOM_CREATOR' });
          }}
          aria-label="Open Case Lab"
          className="relative w-full overflow-hidden rounded-xl border border-gray-800 bg-[#131720] transition hover:border-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 h-[180px] sm:h-[220px] md:h-[260px] lg:h-[300px]"
        >
          <img
            src={caselabImage}
            alt="Caselab showcase"
            className="h-full w-full object-contain"
            loading="lazy"
          />
        </button>
      </div>
    </section>
  );
};
