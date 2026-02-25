import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  isSpinning: boolean;
  spinMode?: 'resolve' | 'indeterminate';
  forcedWin?: boolean;
}

const SPIN_FULL_ROTATIONS = 8;
const SPIN_SETTLE_DURATION_S = 4.2;
const SPIN_RESULT_DELAY_MS = 180;
const RESULT_ZONE_EDGE_BUFFER = 4;

type SpinnerAnimation = {
  rotate: number | number[];
  transition?: {
    duration: number;
    ease: 'linear' | number[];
    repeat?: number;
  };
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  isSpinning,
  spinMode = 'resolve',
  forcedWin
}) => {
  const [animation, setAnimation] = useState<SpinnerAnimation>({ rotate: 0 });
  const spinRunIdRef = useRef(0);
  const resultTimeoutRef = useRef<number | null>(null);

  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const winZoneAngle = (chance / 100) * 360;
  const dashOffset = circumference - (chance / 100) * circumference;

  useEffect(() => {
    if (!isSpinning) {
      spinRunIdRef.current += 1;
      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      setAnimation({ rotate: 0 });
      return;
    }

    if (spinMode === 'indeterminate') {
      spinRunIdRef.current += 1;
      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      setAnimation({
        rotate: [0, 360],
        transition: {
          duration: 1.2,
          ease: 'linear',
          repeat: Infinity
        }
      });
      return;
    }

    startResolveSpin();
  }, [chance, forcedWin, isSpinning, spinMode]);

  const startResolveSpin = () => {
    const spinRunId = spinRunIdRef.current + 1;
    spinRunIdRef.current = spinRunId;

    const isWin = typeof forcedWin === 'boolean' ? forcedWin : Math.random() * 100 <= chance;
    const baseRotations = SPIN_FULL_ROTATIONS * 360;
    const safeWinZoneAngle = Math.min(359.9, Math.max(0.1, winZoneAngle));

    const winStart = RESULT_ZONE_EDGE_BUFFER;
    const winEnd = Math.max(winStart + 0.1, safeWinZoneAngle - RESULT_ZONE_EDGE_BUFFER);

    const loseStart = Math.min(359.8, safeWinZoneAngle + RESULT_ZONE_EDGE_BUFFER);
    const loseEnd = 360 - RESULT_ZONE_EDGE_BUFFER;

    const finalAngle = isWin
      ? winStart + Math.random() * Math.max(0.1, winEnd - winStart)
      : loseStart + Math.random() * Math.max(0.1, loseEnd - loseStart);

    const totalRotation = baseRotations + finalAngle;

    setAnimation({
      rotate: totalRotation,
      transition: {
        duration: SPIN_SETTLE_DURATION_S,
        ease: [0.1, 0.82, 0.18, 1]
      }
    });

    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current);
    }

    resultTimeoutRef.current = window.setTimeout(() => {
      if (spinRunIdRef.current !== spinRunId) return;
      resultTimeoutRef.current = null;
      onFinish(isWin);
    }, SPIN_SETTLE_DURATION_S * 1000 + SPIN_RESULT_DELAY_MS);
  };

  useEffect(() => () => {
    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        aria-hidden
        className="absolute inset-2 rounded-full border border-cyan-300/30"
        animate={
          isSpinning
            ? {
                scale: [1, 1.08, 1],
                opacity: [0.25, 0.65, 0.25],
                boxShadow: [
                  '0 0 0 rgba(34,211,238,0.1)',
                  '0 0 28px rgba(34,211,238,0.55)',
                  '0 0 0 rgba(34,211,238,0.1)'
                ]
              }
            : { scale: 1, opacity: 0.18, boxShadow: '0 0 0 rgba(34,211,238,0)' }
        }
        transition={{ duration: 1.1, repeat: isSpinning ? Infinity : 0, ease: 'easeInOut' }}
      />

      <motion.div
        aria-hidden
        className="absolute inset-0"
        animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 3.2, repeat: isSpinning ? Infinity : 0, ease: 'linear' }}
      >
        <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
        <span className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.9)]" />
        <span className="absolute bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" />
        <span className="absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
      </motion.div>

      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          aria-hidden
          className="absolute h-20 w-20 rounded-full bg-emerald-500/15 blur-xl"
          animate={isSpinning ? { scale: [0.95, 1.15, 0.95], opacity: [0.4, 0.8, 0.4] } : { scale: 1, opacity: 0.35 }}
          transition={{ duration: 1.3, repeat: isSpinning ? Infinity : 0, ease: 'easeInOut' }}
        />
        <span className="text-3xl font-black text-white">{chance.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chance</span>
      </div>

      <motion.div
        animate={animation}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <div className="w-1 h-10 bg-white rounded-full mt-[-4px] relative shadow-[0_0_10px_rgba(255,255,255,0.8)]">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 rounded-sm" />
        </div>
      </motion.div>

      <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute inset-[-10px] rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
};
