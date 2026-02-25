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
  const clampedChance = Math.min(100, Math.max(0, chance));
  const excitementLevel = Math.min(1, Math.max(0.2, clampedChance / 100));

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
    <div
      className="relative flex items-center justify-center"
      style={{ width: 'min(200px, 64vw)', height: 'min(200px, 64vw)', maxWidth: size, maxHeight: size }}
    >
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{ scale: [1, 1.06, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 1.35, ease: 'easeInOut', repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle at center, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.06) 48%, transparent 72%)'
        }}
      />

      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full transform -rotate-90">
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

      <motion.div
        className="absolute inset-2 rounded-full border border-emerald-300/15 pointer-events-none"
        animate={{ rotate: [0, 360], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4 - 1.5 * excitementLevel, ease: 'linear', repeat: Infinity }}
      />

      {[0, 1, 2, 3, 4, 5].map((sparkIdx) => (
        <motion.div
          key={sparkIdx}
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: [sparkIdx * 60, sparkIdx * 60 + 360] }}
          transition={{ duration: 2.8 + sparkIdx * 0.22, ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
        >
          <motion.span
            className="absolute left-1/2 top-[6px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-300/80 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.15 + sparkIdx * 0.1, ease: 'easeInOut', repeat: Infinity }}
          />
        </motion.div>
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white">{chance.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chance</span>
      </div>

      <motion.div
        animate={animation}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <motion.div
          className="w-1 h-10 bg-white rounded-full mt-[-4px] relative shadow-[0_0_14px_rgba(255,255,255,0.95)]"
          animate={{ scaleY: [1, 1.08, 1] }}
          transition={{ duration: 0.45, ease: 'easeInOut', repeat: Infinity }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 rounded-sm" />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-emerald-300/80 blur-[1px]" />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-[14%] rounded-full pointer-events-none"
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
        style={{ border: '1px dashed rgba(148,163,184,0.25)' }}
      >
        <motion.div
          className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-300/80 shadow-[0_0_12px_rgba(34,211,238,0.75)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
        />
      </motion.div>

      <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute inset-[-10px] rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
};
