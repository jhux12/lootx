import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useSpinTickAudio } from './useSpinTickAudio';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  isSpinning: boolean;
  spinMode?: 'resolve' | 'indeterminate';
  forcedWin?: boolean;
}

const SPIN_FULL_ROTATIONS = 8;
const PHASE_1_DURATION_S = 0.6;
const PHASE_2_DURATION_S = 2.4;
const PHASE_3_DURATION_S = 1;
const SPIN_RESULT_DELAY_MS = 200;
const RESULT_ZONE_EDGE_BUFFER = 4;

type SpinnerAnimation = {
  rotate: number | number[];
  transition?: {
    duration: number;
    ease: 'linear' | number[];
    repeat?: number;
  };
};

const easeOutExpo = [0.4, 0.0, 1, 1] as const;
const dramaticSlowEase = [0.1, 0.8, 0.2, 1] as const;

const cubicBezierY = (t: number, p1y: number, p2y: number) => {
  const cY = 3 * p1y;
  const bY = 3 * (p2y - p1y) - cY;
  const aY = 1 - cY - bY;
  return ((aY * t + bY) * t + cY) * t;
};

const getEasedProgress = (progress: number, ease: 'linear' | readonly number[]) => {
  const clamped = Math.min(1, Math.max(0, progress));
  if (ease === 'linear') return clamped;
  return cubicBezierY(clamped, ease[1], ease[3]);
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  isSpinning,
  spinMode = 'resolve',
  forcedWin
}) => {
  const [animation, setAnimation] = useState<SpinnerAnimation>({ rotate: 0 });
  const [isFastPhase, setIsFastPhase] = useState(false);

  const spinRunIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const { playTick } = useSpinTickAudio(0.12);

  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const winZoneAngle = (chance / 100) * 360;
  const dashOffset = circumference - (chance / 100) * circumference;

  const stopTickLoop = () => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    if (!isSpinning) {
      spinRunIdRef.current += 1;
      stopTickLoop();
      setIsFastPhase(false);
      setAnimation({ rotate: 0 });
      return;
    }

    if (spinMode === 'indeterminate') {
      spinRunIdRef.current += 1;
      stopTickLoop();
      setIsFastPhase(false);
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

    void startResolveSpin();
  }, [chance, forcedWin, isSpinning, spinMode]);

  const startTickLoop = (totalRotation: number) => {
    const phase1Target = 720;
    const phase2Target = totalRotation - 360;
    const phaseDurations = [PHASE_1_DURATION_S, PHASE_2_DURATION_S, PHASE_3_DURATION_S];
    const phaseBoundaries = [
      phaseDurations[0] * 1000,
      (phaseDurations[0] + phaseDurations[1]) * 1000,
      (phaseDurations[0] + phaseDurations[1] + phaseDurations[2]) * 1000
    ];

    const startAt = performance.now();
    let previousRotation = 0;

    const stepFrame = (now: number) => {
      const elapsed = now - startAt;
      const cappedElapsed = Math.min(elapsed, phaseBoundaries[2]);

      let rotation = 0;
      let tickStep = 30;

      if (cappedElapsed <= phaseBoundaries[0]) {
        const phaseProgress = cappedElapsed / phaseBoundaries[0];
        rotation = phase1Target * getEasedProgress(phaseProgress, easeOutExpo);
        tickStep = 30;
      } else if (cappedElapsed <= phaseBoundaries[1]) {
        const phaseElapsed = cappedElapsed - phaseBoundaries[0];
        const phaseProgress = phaseElapsed / (phaseDurations[1] * 1000);
        rotation = phase1Target + (phase2Target - phase1Target) * getEasedProgress(phaseProgress, 'linear');
        tickStep = 36;
      } else {
        const phaseElapsed = cappedElapsed - phaseBoundaries[1];
        const phaseProgress = phaseElapsed / (phaseDurations[2] * 1000);
        rotation = phase2Target + (totalRotation - phase2Target) * getEasedProgress(phaseProgress, dramaticSlowEase);
        tickStep = 14;
      }

      if (rotation > previousRotation) {
        const previousBucket = Math.floor(previousRotation / tickStep);
        const currentBucket = Math.floor(rotation / tickStep);
        const ticksToPlay = Math.min(3, currentBucket - previousBucket);

        for (let i = 0; i < ticksToPlay; i += 1) {
          playTick();
        }
      }

      previousRotation = rotation;

      if (elapsed < phaseBoundaries[2]) {
        rafRef.current = window.requestAnimationFrame(stepFrame);
      } else {
        stopTickLoop();
      }
    };

    rafRef.current = window.requestAnimationFrame(stepFrame);
  };

  const startResolveSpin = async () => {
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

    const phase1Target = 720;
    const phase2Target = totalRotation - 360;

    stopTickLoop();
    startTickLoop(totalRotation);

    setIsFastPhase(true);
    setAnimation({
      rotate: phase1Target,
      transition: {
        duration: PHASE_1_DURATION_S,
        ease: [...easeOutExpo]
      }
    });

    await new Promise((resolve) => window.setTimeout(resolve, PHASE_1_DURATION_S * 1000));
    if (spinRunIdRef.current !== spinRunId) return;

    setAnimation({
      rotate: phase2Target,
      transition: {
        duration: PHASE_2_DURATION_S,
        ease: 'linear'
      }
    });

    await new Promise((resolve) => window.setTimeout(resolve, PHASE_2_DURATION_S * 1000));
    if (spinRunIdRef.current !== spinRunId) return;

    setIsFastPhase(false);
    setAnimation({
      rotate: totalRotation,
      transition: {
        duration: PHASE_3_DURATION_S,
        ease: [...dramaticSlowEase]
      }
    });

    await new Promise((resolve) => window.setTimeout(resolve, PHASE_3_DURATION_S * 1000));
    if (spinRunIdRef.current !== spinRunId) return;

    await new Promise((resolve) => window.setTimeout(resolve, SPIN_RESULT_DELAY_MS));
    if (spinRunIdRef.current !== spinRunId) return;

    onFinish(isWin);
  };

  useEffect(() => stopTickLoop, []);

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
        <span className="text-3xl font-black text-white">{chance.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chance</span>
      </div>

      <motion.div
        animate={animation}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center', filter: isFastPhase ? 'blur(2px)' : 'blur(0px)' }}
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
