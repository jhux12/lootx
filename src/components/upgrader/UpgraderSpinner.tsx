import React, { useEffect, useMemo, useRef } from 'react';
import { motion, useAnimationControls } from 'motion/react';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  spinRunId: number;
  forcedWin?: boolean;
}

const SPIN_FULL_ROTATIONS = 8;
const SPIN_DURATION_S = 5.7;
const SPIN_RESULT_DELAY_MS = 200;
const START_ANGLE_DEG = -90;

const randomInRange = (min: number, max: number) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return min;
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
  const isWinRef = useRef(false);
  const totalRotationRef = useRef(0);
  const finalAngleRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  const mountedRef = useRef(true);

  const size = 220;
  const trackStroke = 14;
  const successStroke = 14;
  const radius = (size - trackStroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeChance = useMemo(() => Math.min(99.9999, Math.max(0.0001, chance)), [chance]);
  const successSweepDeg = (safeChance / 100) * 360;
  const successLength = (safeChance / 100) * circumference;
  const successGap = circumference - successLength;

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const resolveOnce = (runId: number) => {
    if (!mountedRef.current || runId !== runIdRef.current || finishedRef.current) return;
    finishedRef.current = true;
    inFlightRef.current = false;
    onFinishRef.current(isWinRef.current);
  };

  const startSpin = async (runId: number) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    finishedRef.current = false;

    controls.stop();
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    controls.set({ rotate: 0 });

    if (!mountedRef.current || runId !== runIdRef.current) {
      inFlightRef.current = false;
      return;
    }

    const edgePaddingDeg = Math.max(1.2, Math.min(6, successSweepDeg * 0.06));
    const winStartDeg = edgePaddingDeg;
    const winEndDeg = Math.max(winStartDeg + 0.01, successSweepDeg - edgePaddingDeg);
    const loseStartDeg = Math.min(359.99, successSweepDeg + edgePaddingDeg);
    const loseEndDeg = 360 - edgePaddingDeg;

    isWinRef.current = typeof forcedWin === 'boolean' ? forcedWin : Math.random() * 100 < safeChance;
    finalAngleRef.current = isWinRef.current
      ? randomInRange(winStartDeg, winEndDeg)
      : randomInRange(loseStartDeg, loseEndDeg);
    totalRotationRef.current = SPIN_FULL_ROTATIONS * 360 + finalAngleRef.current;

    const phaseOne = totalRotationRef.current * 0.2;
    const phaseTwo = totalRotationRef.current * 0.8;

    await controls.start({
      rotate: [0, phaseOne, phaseTwo, totalRotationRef.current],
      transition: {
        duration: SPIN_DURATION_S,
        times: [0, 0.18, 0.72, 1],
        ease: ['easeIn', 'linear', 'easeOut']
      }
    });

    if (!mountedRef.current || runId !== runIdRef.current) {
      inFlightRef.current = false;
      return;
    }

    timeoutRef.current = window.setTimeout(() => resolveOnce(runId), SPIN_RESULT_DELAY_MS);
  };

  useEffect(() => {
    if (spinRunId === 0 || spinRunId === runIdRef.current) return;
    runIdRef.current = spinRunId;
    void startSpin(spinRunId);
  }, [spinRunId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      inFlightRef.current = false;
      controls.stop();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [controls]);

  return (
    <div className="relative flex items-center justify-center w-[min(78vw,220px)] h-[min(78vw,220px)] sm:w-[220px] sm:h-[220px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="upgrader-success-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius + 8}
          fill="none"
          stroke="rgba(148, 163, 184, 0.14)"
          strokeWidth="1.5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius + 14}
          fill="none"
          stroke="rgba(148, 163, 184, 0.08)"
          strokeWidth="1"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(30 41 59)"
          strokeWidth={trackStroke}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth={successStroke}
          strokeLinecap="round"
          strokeDasharray={`${successLength} ${successGap}`}
          strokeDashoffset="0"
          transform={`rotate(${START_ANGLE_DEG} ${size / 2} ${size / 2})`}
          filter="url(#upgrader-success-glow)"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none">
          {safeChance.toFixed(safeChance >= 1 ? 1 : 3)}%
        </span>
        <span className="mt-1 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-[0.24em]">Chance</span>
      </div>

      <motion.div
        animate={controls}
        initial={{ rotate: 0 }}
        className="absolute inset-0 flex items-start justify-center pointer-events-none"
        style={{ transformOrigin: '50% 50%' }}
      >
        <div className="relative mt-[6px] flex h-[98px] sm:h-[104px] w-[2px] items-start justify-center rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.75)]">
          <div className="absolute -top-[6px] h-3 w-3 rotate-45 rounded-[2px] bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
        </div>
      </motion.div>
    </div>
  );
};
