import React, { useEffect, useMemo, useState } from 'react';
import { Item } from './upgraderTypes';
import { AnimatePresence, motion } from 'motion/react';
import { X, RotateCcw, Home, Skull, Check } from 'lucide-react';
import { UpgraderSpinner } from './UpgraderSpinner';
import { CoinAmount } from '../../../components/CoinAmount';

interface UpgraderResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Item | null;
  onRetry: () => void;
  chance: number;
  status: 'processing' | 'win' | 'lose';
  spinId: number;
}

type DisplayStatus = 'settling-win' | 'settling-lose' | 'win' | 'lose';

export const UpgraderResultModal: React.FC<UpgraderResultModalProps> = ({
  isOpen,
  onClose,
  target,
  onRetry,
  status,
  chance,
  spinId
}) => {
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus>('settling-lose');
  const [showWinFx, setShowWinFx] = useState(false);

  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 18;
        const distance = 55 + Math.random() * 80;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance * 0.6;

        return {
          id: `${spinId}-${index}`,
          x,
          y,
          delay: Math.random() * 0.12,
          size: 5 + Math.random() * 4,
          hue: 130 + Math.random() * 35
        };
      }),
    [spinId]
  );

  useEffect(() => {
    if (!isOpen) return;
    setDisplayStatus(status === 'win' ? 'settling-win' : 'settling-lose');
  }, [isOpen, status, spinId]);

  useEffect(() => {
    if (displayStatus !== 'win') {
      setShowWinFx(false);
      return;
    }

    setShowWinFx(true);
    const timeout = window.setTimeout(() => setShowWinFx(false), 820);
    return () => window.clearTimeout(timeout);
  }, [displayStatus]);

  if (!isOpen) return null;

  const isSettling = displayStatus === 'settling-win' || displayStatus === 'settling-lose';
  const isWin = displayStatus === 'win';
  const isLose = displayStatus === 'lose';

  return (
    <>
      {isSettling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-slate-500 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="p-5 sm:p-8 flex flex-col items-center text-center py-10 sm:py-12 gap-4 sm:gap-6">
              <UpgraderSpinner
                key={spinId}
                chance={chance}
                isSpinning
                onFinish={(didWin) => setDisplayStatus(didWin ? 'win' : 'lose')}
                forcedWin={displayStatus === 'settling-win' ? true : displayStatus === 'settling-lose' ? false : undefined}
              />
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Upgrading...</h2>
                <p className="text-slate-400 text-sm">Finalizing spin</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {(isWin || isLose) && (
        <>
          <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <div className="fixed bottom-0 left-0 right-0 z-[100] translate-y-0">
            <motion.div
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)] sm:max-h-[86vh]"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-black/25 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${isWin ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-red-400/40 bg-red-500/15'}`}>
                    {isWin ? <Check className="h-5 w-5 text-emerald-400" /> : <Skull className="h-5 w-5 text-red-300" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white sm:text-lg">{isWin ? 'Upgrade Success' : 'Upgrade Failed'}</h3>
                    <p className="text-xs text-gray-400">{isWin ? 'Your item has been upgraded.' : 'Your source item was consumed.'}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 sm:p-6">
                {isWin && target ? (
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0.7 }}
                    animate={{ scale: [0.6, 1.1, 1], opacity: 1 }}
                    transition={{ duration: 0.55, times: [0, 0.68, 1], type: 'spring', stiffness: 280, damping: 20 }}
                    className="relative mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-emerald-400/20 bg-black/25 p-4 text-center"
                    style={{ boxShadow: '0 0 40px rgba(16,185,129,0.18)' }}
                  >
                    <AnimatePresence>
                      {showWinFx && (
                        <>
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0.6 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300/70"
                          />
                          {confetti.map((particle) => (
                            <motion.div
                              key={particle.id}
                              initial={{ x: 0, y: 0, opacity: 1, scale: 0.8 }}
                              animate={{
                                x: particle.x,
                                y: particle.y + 38,
                                opacity: 0,
                                rotate: particle.x > 0 ? 120 : -120,
                                scale: 1
                              }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8, ease: 'easeOut', delay: particle.delay }}
                              className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                              style={{
                                width: particle.size,
                                height: particle.size,
                                backgroundColor: `hsl(${particle.hue} 85% 62%)`
                              }}
                            />
                          ))}
                        </>
                      )}
                    </AnimatePresence>

                    <div className="absolute inset-0 rounded-2xl opacity-35 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.55)_0%,transparent_72%)]" />
                    <img src={target.imageUrl} alt={target.name} className="relative z-10 mb-3 h-28 w-28 sm:h-32 sm:w-32 object-contain" />
                    <p className="relative z-10 text-xs font-bold text-emerald-400 uppercase tracking-wider">{target.rarity}</p>
                    <h4 className="relative z-10 text-lg font-bold text-white truncate max-w-full">{target.name}</h4>
                    <CoinAmount
                      amount={Math.round(target.coinValue)}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="relative z-10 mt-2 font-semibold text-gray-200"
                      iconClassName="w-4 h-4"
                    />
                  </motion.div>
                ) : (
                  <div className="mx-auto max-w-sm rounded-2xl border border-red-500/20 bg-black/25 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 border border-red-400/30">
                      <Skull className="h-7 w-7 text-red-300" />
                    </div>
                    <h4 className="text-lg font-bold text-white">Busted</h4>
                    <p className="mt-1 text-sm text-slate-300">The selected source item has been consumed. Pick another item and try again.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-black/20 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={onRetry}
                    className="h-14 px-4 sm:h-12 sm:px-3 flex-1 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10 inline-flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" /> Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className={`h-14 px-4 sm:h-12 sm:px-3 flex-1 rounded-xl text-sm font-bold text-white transition inline-flex items-center justify-center gap-2 ${isWin ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                  >
                    <Home className="h-4 w-4" /> {isWin ? 'Inventory' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </>
  );
};
