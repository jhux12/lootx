import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import caselabImage from '../assets/caselab.gif';
import { BoxCard } from './BoxCard';

export const BoxGrid: React.FC = () => {
  const { setView, boxes } = useGame();
  const { playSound } = useSound();

  // Filter out user-created and daily free boxes from the main shop/grid
  const displayBoxes = boxes.filter(box => !box.isUserCreated && !box.isDaily);
  return (
    <section className="mt-12 px-4 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <GiftIcon /> Featured Mystery Boxes
        </h3>
        <div className="flex gap-2">
           <div className="flex bg-brand-card rounded-lg p-1">
             <button className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick={() => playSound('click')}><ChevronLeft className="w-4 h-4" /></button>
             <button className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick={() => playSound('click')}><ChevronRight className="w-4 h-4" /></button>
           </div>
           <button
             className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold text-white transition-colors shadow-lg shadow-blue-900/20"
             onClick={() => {
               playSound('click');
               setView({ type: 'BOXES' });
             }}
           >
             View all boxes
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayBoxes.map((box) => (
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
      <div className="mt-6 w-full">
        <button
          type="button"
          onClick={() => {
            playSound('click');
            setView({ type: 'CUSTOM_CREATOR' });
          }}
          aria-label="Open Case Lab"
          className="relative w-full aspect-video overflow-hidden rounded-xl border border-gray-800 bg-[#131720] transition hover:border-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
        >
          <img
            src={caselabImage}
            alt="Caselab showcase"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
      </div>
    </section>
  );
};

const GiftIcon = () => (
    <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C10.9 2 10 2.9 10 4V6H5C3.9 6 3 6.9 3 8V10H21V8C21 6.9 20.1 6 19 6H14V4C14 2.9 13.1 2 12 2ZM5 12V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V12H5Z" opacity="0.4" />
        <path d="M12 22C13.1 22 14 21.1 14 20V12H10V20C10 21.1 10.9 22 12 22Z" />
    </svg>
);
