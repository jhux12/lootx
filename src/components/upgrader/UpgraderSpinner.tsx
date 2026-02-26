import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  isSpinning: boolean;
  spinMode?: 'resolve' | 'indeterminate';
  forcedWin?: boolean;
}

const SPIN_FULL_ROTATIONS = 10;
const SPIN_SETTLE_DURATION_S = 5.8;
const SPIN_RESULT_DELAY_MS = 180;

type SpinnerAnimation = {
  rotate: number | number[];
  transition?: {
    duration: number;
    ease: 'linear' | number[];
    repeat?: number;
  };
};

const randomInRange = (min: number, max: number) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min) return min;
  return min + Math.random() * (max - min);
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  isSpinning,
  spinMode = 'resolve',
  forcedWin
}) => {
  const [animation, setAnimation] = useState<SpinnerAnimation>({ rotate: 0 });
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const spinningRef = useRef(false);
  const spinRunIdRef = useRef(0);
  const resultTimeoutRef = useRef<number | null>(null);

  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeChance = Math.min(99.9999, Math.max(0.0001, chance));
  const winZoneAngle = (safeChance / 100) * 360;
  const dashOffset = circumference - (safeChance / 100) * circumference;

  useEffect(() => {
    const audio = new Audio('/assets/upgrader.mp3');
    audio.preload = 'auto';
    spinAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      spinAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isSpinning) {
      spinningRef.current = false;
      spinRunIdRef.current += 1;
      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      if (spinAudioRef.current) spinAudioRef.current.pause();
      setAnimation({ rotate: 0 });
      return;
    }

    if (spinningRef.current) return;
    spinningRef.current = true;

    if (spinMode === 'indeterminate') {
      spinRunIdRef.current += 1;
      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      if (spinAudioRef.current) {
        spinAudioRef.current.currentTime = 0;
        spinAudioRef.current.play().catch(() => {});
      }
      setAnimation({
        rotate: [0, 360],
        transition: {
          duration: 1.4,
          ease: 'linear',
          repeat: Infinity
        }
      });
      return;
    }

    const spinRunId = spinRunIdRef.current + 1;
    spinRunIdRef.current = spinRunId;

    const isWin = typeof forcedWin === 'boolean' ? forcedWin : Math.random() * 100 <= safeChance;
    const baseRotations = SPIN_FULL_ROTATIONS * 360;

    const edgePadding = 0.2;
    const winStart = edgePadding;
    const winEnd = Math.max(winStart + 0.01, winZoneAngle - edgePadding);

    const loseStart = Math.min(359.99, winZoneAngle + edgePadding);
    const loseEnd = 360 - edgePadding;

    const finalAngle = isWin
      ? randomInRange(winStart, winEnd)
      : randomInRange(loseStart, loseEnd);

    const totalRotation = baseRotations + finalAngle;

    if (spinAudioRef.current) {
      spinAudioRef.current.currentTime = 0;
      spinAudioRef.current.play().catch(() => {});
    }

    setAnimation({
      rotate: totalRotation,
      transition: {
        duration: SPIN_SETTLE_DURATION_S,
        ease: [0.08, 0.86, 0.16, 1]
      }
    });

    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current);
    }

    resultTimeoutRef.current = window.setTimeout(() => {
      if (spinRunIdRef.current !== spinRunId) return;
      resultTimeoutRef.current = null;
      if (spinAudioRef.current) spinAudioRef.current.pause();
      spinningRef.current = false;
      onFinish(isWin);
    }, SPIN_SETTLE_DURATION_S * 1000 + SPIN_RESULT_DELAY_MS);
  }, [isSpinning, spinMode, forcedWin, safeChance, onFinish, winZoneAngle]);

  useEffect(() => () => {
    spinningRef.current = false;
    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
    if (spinAudioRef.current) {
      spinAudioRef.current.pause();
      spinAudioRef.current.src = '';
      spinAudioRef.current = null;
    }
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
        <span className="text-3xl font-black text-white">{safeChance.toFixed(safeChance >= 1 ? 1 : 4)}%</span>
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
