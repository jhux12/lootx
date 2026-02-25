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
  const isIndeterminate = spinMode === 'indeterminate' && isSpinning;

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
    <div
      className="relative flex items-center justify-center"
      style={{ width: 'min(200px, 64vw)', aspectRatio: '1 / 1' }}
    >
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{
          scale: isSpinning ? [0.96, 1.03, 0.97] : 1,
          opacity: isSpinning ? [0.6, 0.95, 0.65] : 0.5
        }}
        transition={{ duration: 1.8, ease: 'easeInOut', repeat: isSpinning ? Infinity : 0 }}
        style={{
          background:
            'radial-gradient(circle, rgba(20,184,166,0.24) 0%, rgba(16,185,129,0.08) 40%, rgba(15,23,42,0) 72%)'
        }}
      />

      <motion.div
        className="absolute inset-[-12px] rounded-full border border-cyan-300/25 pointer-events-none"
        animate={{ rotate: [0, 360], opacity: isSpinning ? [0.28, 0.6, 0.28] : 0.22 }}
        transition={{ duration: isIndeterminate ? 1.8 : 6.5, ease: 'linear', repeat: isSpinning ? Infinity : 0 }}
      />

      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 relative z-10">
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

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span className="text-2xl sm:text-3xl font-black text-white">{chance.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chance</span>
      </div>

      <motion.div
        animate={animation}
        className="absolute inset-0 z-30 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <div className="w-1 h-10 bg-white rounded-full mt-[-4px] relative shadow-[0_0_10px_rgba(255,255,255,0.8)]">
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ opacity: isSpinning ? [0.4, 1, 0.4] : 0.8 }}
            transition={{ duration: 0.45, repeat: isSpinning ? Infinity : 0, ease: 'easeInOut' }}
            style={{ boxShadow: '0 0 14px rgba(56,189,248,0.95)' }}
          />
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 rounded-sm" />
        </div>
      </motion.div>

      {isSpinning && (
        <>
          {[...Array(6)].map((_, i) => {
            const delay = i * 0.2;
            const angle = i * 60;

            return (
              <motion.div
                key={`spark-${angle}`}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full pointer-events-none"
                animate={{
                  x: [0, Math.cos((angle * Math.PI) / 180) * 84],
                  y: [0, Math.sin((angle * Math.PI) / 180) * 84],
                  opacity: [0, 0.9, 0],
                  scale: [0.35, 1.1, 0.5]
                }}
                transition={{
                  duration: isIndeterminate ? 1.05 : 1.45,
                  repeat: Infinity,
                  delay,
                  ease: 'easeOut'
                }}
                style={{
                  backgroundColor: i % 2 === 0 ? 'rgba(34,211,238,0.9)' : 'rgba(16,185,129,0.9)',
                  boxShadow: '0 0 10px rgba(45,212,191,0.9)'
                }}
              />
            );
          })}
        </>
      )}

      <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute inset-[-10px] rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
};
