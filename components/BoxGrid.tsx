import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { getRiskLabel } from '../utils/caseOdds';

export const BoxGrid: React.FC = () => {
  const { setView, boxes } = useGame();
  const { playSound } = useSound();

  // Filter out user-created and daily free boxes from the main shop/grid
  const displayBoxes = boxes.filter(box => !box.isUserCreated && !box.isDaily);

  return (
    <section className="mt-12 px-4 md:px-0">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <GiftIcon /> Popular Mystery Boxes
        </h3>
        <div className="flex gap-2">
           <div className="flex bg-brand-card rounded-lg p-1">
             <button className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick={() => playSound('click')}><ChevronLeft className="w-4 h-4" /></button>
             <button className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick={() => playSound('click')}><ChevronRight className="w-4 h-4" /></button>
           </div>
           <button className="px-4 py-2 bg-brand-card hover:bg-gray-700 rounded-lg text-sm font-bold text-gray-300 transition-colors" onClick={() => playSound('click')}>
             View all
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayBoxes.map((box) => (
          <div 
            key={box.id} 
            onClick={() => { playSound('click'); setView({ type: 'CASE_OPENING', boxId: box.id }); }}
            onMouseEnter={() => playSound('hover')}
            className="group relative bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col items-center hover:border-gray-600 transition-all cursor-pointer hover:-translate-y-1"
          >
            {/* Tag */}
            {box.tag && (
                <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded uppercase tracking-wide z-10">
                    {box.tag}
                </span>
            )}
            
            {/* Image Container with Glow */}
            <div className="relative w-full aspect-square mb-4 flex items-center justify-center">
                <div 
                    className="absolute inset-4 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
                    style={{ backgroundColor: box.accentColor }}
                ></div>
                <img 
                    src={box.image} 
                    alt={box.name} 
                    className="relative z-10 w-3/4 h-3/4 object-contain drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300" 
                />
            </div>

            {/* Info */}
            <div className="text-center w-full">
                <h4 className="text-gray-400 text-sm font-medium mb-1 group-hover:text-white">{box.name}</h4>
                <CoinAmount
                  amount={box.price}
                  formatOptions={{ maximumFractionDigits: 0 }}
                  className="text-white font-bold text-lg justify-center"
                  iconClassName="w-4 h-4"
                />
                <div className="mt-2 text-[10px] uppercase tracking-wide text-gray-500">
                  {getRiskLabel(box.riskLevel ?? 50)}
                </div>
            </div>

            {/* Bottom Color Bar */}
            <div 
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-t-full opacity-50 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: box.accentColor, boxShadow: `0 0 10px ${box.accentColor}` }}
            />
          </div>
        ))}
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
