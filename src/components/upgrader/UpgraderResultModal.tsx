import React from 'react';
import { Item } from './upgraderTypes';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Home, Trophy, Skull } from 'lucide-react';
import { UpgraderSpinner } from './UpgraderSpinner';

interface UpgraderResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Item | null;
  onRetry: () => void;
  chance: number;
  status: 'processing' | 'win' | 'lose';
}

export const UpgraderResultModal: React.FC<UpgraderResultModalProps> = ({
  isOpen,
  onClose,
  target,
  onRetry,
  status,
  chance
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            {status === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center gap-6 w-full"
              >
                <UpgraderSpinner
                  chance={chance}
                  isSpinning={status === 'processing'}
                  onFinish={() => {}}
                  spinMode="indeterminate"
                />
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Upgrading...</h2>
                  <p className="text-slate-400 text-sm">Waiting for server result</p>
                </div>
              </motion.div>
            )}

            {status === 'win' && (
              <motion.div
                key="win"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-8 flex flex-col items-center gap-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse" />
                  <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    <Trophy className="w-12 h-12 text-white" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-emerald-500 uppercase italic tracking-tighter">SUCCESS!</h2>
                  <p className="text-slate-300">You upgraded to a new item!</p>
                </div>

                {target && (
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/30 w-full">
                    <div className="flex items-center gap-4">
                      <img src={target.imageUrl} alt={target.name} className="w-16 h-16 rounded-lg object-cover" />
                      <div className="text-left">
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{target.rarity}</p>
                        <p className="text-sm font-bold text-white leading-tight">{target.name}</p>
                        <p className="text-xs font-mono text-slate-400">${target.coinValue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 w-full mt-4">
                  <button
                    onClick={onRetry}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Home className="w-4 h-4" /> Inventory
                  </button>
                </div>
              </motion.div>
            )}

            {status === 'lose' && (
              <motion.div
                key="lose"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-8 flex flex-col items-center gap-6"
              >
                <div className="relative w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                  <Skull className="w-12 h-12 text-white" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-red-500 uppercase italic tracking-tighter">BUSTED</h2>
                  <p className="text-slate-300">Your item was consumed.</p>
                </div>

                <div className="flex gap-3 w-full mt-4">
                  <button
                    onClick={onRetry}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Home className="w-4 h-4" /> Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
