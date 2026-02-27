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
  const totalRotationRef = useRef(0);
  const isWinRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const mountedRef = useRef(true);

  const size = 260;
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
    const finalAngle = isWinRef.current
      ? winLandingAngle
      : loseLandingAngle;
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
    <div className="relative flex items-center justify-center w-[220px] h-[220px] sm:w-[260px] sm:h-[260px]">
      <div className="absolute inset-[-18px] rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(20,184,166,0.2),transparent_55%),radial-gradient(circle_at_60%_80%,rgba(168,85,247,0.25),transparent_60%)] blur-xl" />

      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-900"
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
          className="text-teal-400 drop-shadow-[0_0_18px_rgba(45,212,191,0.7)]"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl sm:text-5xl font-black text-white">{safeChance.toFixed(safeChance >= 1 ? 2 : 4)}%</span>
        <span className="text-[10px] sm:text-xs font-bold text-violet-200/80 uppercase tracking-[0.35em]">Win odds</span>
        <span className="mt-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] sm:text-xs font-semibold text-cyan-100">
          Landing: {safeChance.toFixed(4)}%
        </span>
      </div>

      <motion.div
        animate={controls}
        initial={{ rotate: 0 }}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <div className="w-2 h-14 sm:h-16 bg-gradient-to-b from-yellow-200 via-amber-300 to-orange-500 rounded-full mt-[-5px] relative shadow-[0_0_14px_rgba(251,191,36,0.8)]">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-200 rotate-45 rounded-sm border border-yellow-50/60" />
        </div>
      </motion.div>

      <div className="absolute inset-0 rounded-full border border-cyan-200/10 pointer-events-none" />
      <div className="absolute inset-[-10px] rounded-full border border-violet-200/10 pointer-events-none" />
    </div>
  );
};
