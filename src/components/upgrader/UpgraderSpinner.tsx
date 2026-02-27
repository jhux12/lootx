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
const LANDING_EDGE_PADDING_DEG = 0.2;

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

  const size = 280;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeChance = Math.min(99.9999, Math.max(0.0001, chance));
  const winZoneAngle = (safeChance / 100) * 360;
  const dashOffset = circumference - (safeChance / 100) * circumference;
  const loseZoneAngle = Math.max(0.0001, 360 - winZoneAngle);
  const winLandingAngle = Math.max(
    LANDING_EDGE_PADDING_DEG,
    Math.min(359.99 - LANDING_EDGE_PADDING_DEG, winZoneAngle / 2)
  );
  const loseLandingAngle = Math.min(
    359.99 - LANDING_EDGE_PADDING_DEG,
    Math.max(winZoneAngle + LANDING_EDGE_PADDING_DEG, winZoneAngle + loseZoneAngle / 2)
  );

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

    isWinRef.current = typeof forcedWin === 'boolean' ? forcedWin : Math.random() * 100 <= safeChance;
    const baseRotations = SPIN_FULL_ROTATIONS * 360;
    const finalAngle = isWinRef.current ? winLandingAngle : loseLandingAngle;

    await controls.start({
      rotate: baseRotations + finalAngle,
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
    <div className="relative flex items-center justify-center w-[230px] h-[230px] sm:w-[280px] sm:h-[280px]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(88,101,242,0.28),rgba(9,12,31,0.96)_70%)]" />
      <div className="absolute inset-[-18px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22),transparent_65%)] blur-2xl" />

      <motion.svg
        animate={controls}
        initial={{ rotate: 0 }}
        width={size}
        height={size}
        className="relative z-10 -rotate-90"
        style={{ transformOrigin: '50% 50%' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-indigo-300/25"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#upgraderSpinGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="drop-shadow-[0_0_16px_rgba(168,85,247,0.75)]"
        />
        <defs>
          <linearGradient id="upgraderSpinGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
      </motion.svg>

      <div className="absolute z-20 left-[8px] sm:left-[10px] top-1/2 -translate-y-1/2 -translate-x-1/2">
        <div className="h-0 w-0 border-y-[10px] border-y-transparent border-r-[16px] border-r-[#c4b5fd] drop-shadow-[0_0_10px_rgba(196,181,253,0.85)] sm:border-y-[12px] sm:border-r-[19px]" />
      </div>

      <div className="absolute inset-[18px] sm:inset-[22px] z-10 rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(72,88,194,0.38),rgba(7,10,25,0.95)_72%)] border border-indigo-200/10" />

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center">
        <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{safeChance.toFixed(safeChance >= 1 ? 2 : 4)}%</span>
        <span className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.28em] text-violet-200/80">Upgrade odds</span>
        <span className="mt-3 rounded-full border border-violet-200/25 bg-violet-300/10 px-3 py-1 text-[10px] sm:text-xs font-semibold text-violet-100">
          Exact chance: {safeChance.toFixed(4)}%
        </span>
      </div>
    </div>
  );
};
