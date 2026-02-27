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
const DEFAULT_WIN_LANDING_ANGLE = 24;
const DEFAULT_LOSE_LANDING_ANGLE = 230;
const WIN_LANDING_OFFSETS = [12, 24, 38, 52, 67];
const LOSE_LANDING_OFFSETS = [0.18, 0.32, 0.46, 0.61, 0.78];

const clampChance = (value: number) => Math.min(99.9999, Math.max(0.0001, value));

const pickDeterministicIndex = (seed: number, length: number) => {
  if (!length) return 0;
  return Math.abs((seed * 37 + 17) % length);
};

const resolveLandingAngle = (isWin: boolean, safeChance: number, runId: number) => {
  const winZoneAngle = (safeChance / 100) * 360;

  if (isWin) {
    const maxWinAngle = Math.max(6, winZoneAngle - 6);
    if (maxWinAngle <= 6) return Math.min(winZoneAngle * 0.5, DEFAULT_WIN_LANDING_ANGLE);
    const index = pickDeterministicIndex(runId, WIN_LANDING_OFFSETS.length);
    return Math.min(maxWinAngle, WIN_LANDING_OFFSETS[index]);
  }

  const loseStart = Math.min(359, winZoneAngle + 6);
  const loseSpan = Math.max(8, 360 - loseStart - 6);
  if (loseSpan <= 8) return DEFAULT_LOSE_LANDING_ANGLE;
  const index = pickDeterministicIndex(runId, LOSE_LANDING_OFFSETS.length);
  return loseStart + loseSpan * LOSE_LANDING_OFFSETS[index];
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
  const isWinRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const mountedRef = useRef(true);

  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeChance = clampChance(chance);
  const winZoneAngle = (safeChance / 100) * 360;
  const dashOffset = circumference - (safeChance / 100) * circumference;

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const safeFinish = (runId: number) => {
    if (!mountedRef.current || runId !== runIdRef.current || finishedRef.current) return;
    finishedRef.current = true;
    inFlightRef.current = false;
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

    // Spinner outcome is animation-only and should reflect the pre-computed server result when provided.
    isWinRef.current = typeof forcedWin === 'boolean' ? forcedWin : runId % 100 < safeChance;
    const finalAngle = resolveLandingAngle(isWinRef.current, safeChance, runId);
    const totalRotation = SPIN_FULL_ROTATIONS * 360 + finalAngle;

    await controls.start({
      rotate: totalRotation,
      transition: {
        duration: SPIN_SETTLE_DURATION_S,
        ease: [0.08, 0.78, 0.22, 1]
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
    if (spinRunId === 0) return;
    if (spinRunId === runIdRef.current) return;

    runIdRef.current = spinRunId;
    void startSpinOnce(spinRunId);
  }, [spinRunId]);

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
    <div className="relative flex items-center justify-center w-[168px] h-[168px] sm:w-[200px] sm:h-[200px]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.14)_0%,rgba(15,23,42,0)_66%)]" />
      <svg width={size} height={size} className="-rotate-90 scale-[0.84] sm:scale-100">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800/95"
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
          className="text-brand-purple drop-shadow-[0_0_10px_rgba(139,92,246,0.45)]"
        />
      </svg>

      <div className="absolute inset-[14px] sm:inset-[16px] rounded-full border border-white/5" />
      <div className="absolute inset-[9px] sm:inset-[10px] rounded-full border border-brand-purple/20" />

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="w-[126px] h-[126px] sm:w-[146px] sm:h-[146px] rounded-full border border-white/10">
          <div className="h-full w-full rounded-full bg-[conic-gradient(from_0deg,rgba(255,255,255,0.05)_0deg,rgba(255,255,255,0)_40deg,rgba(255,255,255,0.05)_90deg,rgba(255,255,255,0)_145deg,rgba(255,255,255,0.05)_210deg,rgba(255,255,255,0)_260deg,rgba(255,255,255,0.05)_330deg,rgba(255,255,255,0)_360deg)]" />
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-2.5 sm:px-5 shadow-[0_0_18px_rgba(76,29,149,0.45)]">
          <span className="text-xl sm:text-3xl font-black text-white leading-none">{safeChance.toFixed(safeChance >= 1 ? 1 : 4)}%</span>
        </div>
        <span className="mt-1.5 text-[9px] sm:text-[10px] font-bold text-violet-300 uppercase tracking-[0.2em]">Upgrade odds</span>
      </div>

      <motion.div
        animate={controls}
        initial={{ rotate: 0 }}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <div className="w-2 h-10 sm:h-11 mt-[-4px] rounded-full border border-violet-200/70 bg-gradient-to-b from-violet-100 via-brand-purple to-violet-900 shadow-[0_0_14px_rgba(139,92,246,0.65)] relative">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-violet-100/70 bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.8)]" />
        </div>
      </motion.div>

      <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute inset-[-8px] rounded-full border border-brand-purple/20 pointer-events-none" />
    </div>
  );
};
