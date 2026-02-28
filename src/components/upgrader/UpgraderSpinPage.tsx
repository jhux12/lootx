import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Zap } from 'lucide-react';
import { UpgraderSpinner } from './UpgraderSpinner';
import { Item } from './upgraderTypes';
import { CoinAmount } from '../../../components/CoinAmount';

interface UpgraderSpinPageProps {
  target: Item | null;
  chance: number;
  spinId: number;
  outcome: 'win' | 'lose' | null;
  hasPendingUpgrade: boolean;
  isDetermining: boolean;
  onConfirmUpgrade: () => void;
  isConfirming: boolean;
  onReturn: () => void;
}

type SpinPhase = 'confirm' | 'determining' | 'spinning' | 'result';

export const UpgraderSpinPage: React.FC<UpgraderSpinPageProps> = ({
  target,
  chance,
  spinId,
  outcome,
  hasPendingUpgrade,
  isDetermining,
  onConfirmUpgrade,
  isConfirming,
  onReturn
}) => {
  const [phase, setPhase] = useState<SpinPhase>('confirm');

  useEffect(() => {
    if (hasPendingUpgrade && !isDetermining && !outcome) {
      setPhase('confirm');
      return;
    }

    if (isDetermining) {
      setPhase('determining');
      return;
    }

    if (outcome) {
      setPhase('spinning');
    }
  }, [hasPendingUpgrade, isDetermining, outcome, spinId]);

  const subtitle = useMemo(() => {
    if (phase === 'confirm') return 'Review your chance, then confirm to begin the upgrade spin.';
    if (phase === 'determining') return 'Locking in your provably fair result...';
    if (phase === 'spinning') return 'Wheel is spinning to reveal your outcome.';
    return outcome === 'win' ? 'Huge hit. Your upgrade landed.' : 'Missed this one. Better luck next spin.';
  }, [outcome, phase]);

  const isWin = outcome === 'win' && phase === 'result';

  return (
    <section className="min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 sm:p-8">
        <div className="text-center space-y-2">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500 font-bold">Upgrade Session</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            {phase === 'confirm'
              ? 'Confirm Upgrade'
              : phase === 'result'
                ? (isWin ? 'Upgrade Success' : 'Upgrade Failed')
                : 'Upgrade in Progress'}
          </h2>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>

        <div className="mt-6 sm:mt-8 flex items-center justify-center">
          {phase === 'confirm' ? (
            <div className="w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] rounded-full border border-slate-700 bg-slate-950/80 flex flex-col items-center justify-center text-center px-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Chance</p>
              <p className="text-5xl sm:text-6xl font-black text-white mt-2">{chance.toFixed(chance >= 1 ? 1 : 4)}%</p>
              <p className="text-sm text-slate-300 mt-3">Press confirm to start. The wheel will spin once and reveal the server result.</p>
              <button
                type="button"
                onClick={onConfirmUpgrade}
                disabled={isConfirming}
                className="mt-5 w-full max-w-[220px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4 fill-current" /> {isConfirming ? 'Confirming...' : 'Confirm Upgrade'}
              </button>
            </div>
          ) : phase === 'determining' ? (
            <div className="w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] rounded-full border border-indigo-500/25 bg-indigo-500/5 flex flex-col items-center justify-center text-center px-6">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-300/30 border-t-indigo-400 animate-spin mb-4" />
              <p className="text-sm text-slate-200 font-semibold">Determining outcome</p>
              <p className="text-xs text-slate-400 mt-1">Please hold on for a moment.</p>
            </div>
          ) : (
            <UpgraderSpinner
              chance={chance}
              spinRunId={spinId}
              forcedWin={outcome === 'win'}
              onFinish={() => setPhase('result')}
              size={320}
            />
          )}
        </div>

        {phase === 'result' && (
          <div className="mt-6 sm:mt-8 space-y-4">
            {isWin && target ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                <img src={target.imageUrl} alt={target.name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-emerald-300">{target.rarity}</p>
                  <p className="text-base sm:text-lg font-bold text-white truncate">{target.name}</p>
                  <CoinAmount amount={Math.round(target.coinValue)} className="text-sm text-slate-200" iconClassName="w-4 h-4" formatOptions={{ maximumFractionDigits: 0 }} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                Your source item was consumed. Choose a new source item to try again.
              </div>
            )}
          </div>
        )}

        <button
          onClick={onReturn}
          className="mt-7 w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-bold py-3 inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to upgrader
        </button>
      </div>
    </section>
  );
};
