import React from 'react';

type Props = {
  result: null | { win: boolean; awardedItem?: { name: string; imageUrl: string }; roll: number; chance: number };
  onClose: () => void;
};

export const UpgradeResultModal: React.FC<Props> = ({ result, onClose }) => {
  if (!result) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#090f1d] p-5 text-center">
        <h3 className={`text-2xl font-black ${result.win ? 'text-emerald-300' : 'text-rose-300'}`}>{result.win ? 'UPGRADE SUCCESS' : 'BUST'}</h3>
        {result.win && result.awardedItem && (
          <div className="mt-3">
            <img src={result.awardedItem.imageUrl} alt={result.awardedItem.name} className="mx-auto h-20 w-20 rounded-xl object-cover" />
            <div className="mt-1 text-sm text-white">{result.awardedItem.name} added to inventory</div>
          </div>
        )}
        <div className="mt-3 text-xs text-gray-400">Roll {(result.roll * 100).toFixed(4)} · Chance {(result.chance * 100).toFixed(2)}%</div>
        <button onClick={onClose} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Close</button>
      </div>
    </div>
  );
};
