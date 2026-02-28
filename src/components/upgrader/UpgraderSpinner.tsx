import React, { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'motion/react';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  spinRunId: number;
  forcedWin?: boolean;
}

const SPIN_FULL_ROTATIONS = 10;
const SPIN_SETTLE_DURATION_S = 5.8;
const SPIN_RESULT_DELAY_MS = 180;

const randomInRange = (min: number, max: number) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min) return min;
  return min + Math.random() * (max - min);
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  spinRunId,
  forcedWin
}) => {
  const controls = useAnimationControls();
  const runIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const finishedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const totalRotationRef = useRef(0);
  const isWinRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const mountedRef = useRef(true);

  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeChance = Math.min(99.9999, Math.max(0.0001, chance));
  const winZoneAngle = (safeChance / 100) * 360;
  const dashOffset = circumference - (safeChance / 100) * circumference;

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const safeFinish = (runId: number) => {
    if (!mountedRef.current || runId !== runIdRef.current || finishedRef.current) return;
    finishedRef.current = true;
    inFlightRef.current = false;
    console.log('[UpgraderSpinner] finish', runId);
    onFinishRef.current(isWinRef.current);
  };

  const startSpinOnce = async (runId: number) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    finishedRef.current = false;

    controls.stop();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await controls.set({ rotate: 0 });
    if (!mountedRef.current || runId !== runIdRef.current) {
      inFlightRef.current = false;
      return;
    }

    isWinRef.current = typeof forcedWin === 'boolean' ? forcedWin : Math.random() * 100 <= safeChance;
    const baseRotations = SPIN_FULL_ROTATIONS * 360;
    const edgePadding = 0.2;
    const winStart = edgePadding;
    const winEnd = Math.max(winStart + 0.01, winZoneAngle - edgePadding);
    const loseStart = Math.min(359.99, winZoneAngle + edgePadding);
    const loseEnd = 360 - edgePadding;
    const finalAngle = isWinRef.current
      ? randomInRange(winStart, winEnd)
      : randomInRange(loseStart, loseEnd);
    totalRotationRef.current = baseRotations + finalAngle;

    console.log('[UpgraderSpinner] start', runId);

    await controls.start({
      rotate: totalRotationRef.current,
      transition: {
        duration: SPIN_SETTLE_DURATION_S,
        ease: [0.08, 0.86, 0.16, 1]
      }
    });

    if (!mountedRef.current || runId !== runIdRef.current) {
      inFlightRef.current = false;
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(() => safeFinish(runId));
    }, SPIN_RESULT_DELAY_MS);
  };

  useEffect(() => {
    if (spinRunId === 0) {
      runIdRef.current = 0;
      finishedRef.current = false;
      inFlightRef.current = false;
      void controls.set({ rotate: 0 });
      return;
    }
    if (spinRunId === runIdRef.current) return;

    runIdRef.current = spinRunId;
    void startSpinOnce(spinRunId);
  }, [controls, spinRunId]);

  useEffect(() => () => {
    mountedRef.current = false;
    inFlightRef.current = false;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    controls.stop();
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
        animate={controls}
        initial={{ rotate: 0 }}
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
