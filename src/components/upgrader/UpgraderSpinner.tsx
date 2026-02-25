import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'motion/react';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  isSpinning: boolean;
  spinMode?: 'resolve' | 'indeterminate';
  forcedWin?: boolean;
}

const SPIN_FULL_ROTATIONS = 8;
const RESULT_ZONE_EDGE_BUFFER = 4;
const PHASE_ONE_DURATION_S = 0.6;
const PHASE_TWO_DURATION_S = 2.4;
const PHASE_THREE_DURATION_S = 1;
const RESULT_SUSPENSE_DELAY_MS = 200;

type TickPhase = 'phase1' | 'phase2' | 'phase3';

const phaseTickStep: Record<TickPhase, number> = {
  phase1: 28,
  phase2: 24,
  phase3: 14
};

const phaseTickVolume: Record<TickPhase, number> = {
  phase1: 0.1,
  phase2: 0.12,
  phase3: 0.16
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  isSpinning,
  spinMode = 'resolve',
  forcedWin
}) => {
  const controls = useAnimation();
  const [isFastPhase, setIsFastPhase] = useState(false);
  const spinRunIdRef = useRef(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const rotationTickRef = useRef({ lastRotation: 0, nextTrigger: 0 });
  const phaseRef = useRef<TickPhase>('phase1');

  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const winZoneAngle = (chance / 100) * 360;
  const dashOffset = circumference - (chance / 100) * circumference;

  useEffect(() => {
    if (!isSpinning) {
      spinRunIdRef.current += 1;
      setIsFastPhase(false);
      void controls.start({ rotate: 0, transition: { duration: 0 } });
      return;
    }

    if (spinMode === 'indeterminate') {
      const spinRunId = spinRunIdRef.current + 1;
      spinRunIdRef.current = spinRunId;
      setIsFastPhase(true);
      void controls.start({ rotate: 0, transition: { duration: 0 } });
      void (async () => {
        while (spinRunIdRef.current === spinRunId) {
          await controls.start({
            rotate: 360,
            transition: {
              duration: 1.2,
              ease: 'linear'
            }
          });
          if (spinRunIdRef.current !== spinRunId) break;
          void controls.start({ rotate: 0, transition: { duration: 0 } });
        }
      })();
      return;
    }

    void startResolveSpin();
  }, [chance, controls, forcedWin, isSpinning, spinMode]);

  const ensureAudioContext = () => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playTick = (phase: TickPhase) => {
    const context = ensureAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(phase === 'phase3' ? 1400 : 1050, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(phaseTickVolume[phase], now + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.055);
  };

  const runTickLoop = (fromRotation: number, toRotation: number, durationS: number, phase: TickPhase, spinRunId: number) => {
    phaseRef.current = phase;
    rotationTickRef.current = {
      lastRotation: fromRotation,
      nextTrigger: fromRotation + phaseTickStep[phase]
    };

    return new Promise<void>((resolve) => {
      const startTime = performance.now();

      const frame = () => {
        if (spinRunIdRef.current !== spinRunId) {
          resolve();
          return;
        }

        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(1, elapsed / durationS);
        const currentRotation = fromRotation + (toRotation - fromRotation) * progress;

        while (currentRotation >= rotationTickRef.current.nextTrigger) {
          playTick(phaseRef.current);
          rotationTickRef.current.nextTrigger += phaseTickStep[phaseRef.current];
        }

        rotationTickRef.current.lastRotation = currentRotation;

        if (progress >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
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
    const phaseOneTarget = 720;
    const phaseTwoTarget = Math.max(phaseOneTarget, totalRotation - 360);

    void controls.start({ rotate: 0, transition: { duration: 0 } });

    setIsFastPhase(true);
    await Promise.all([
      controls.start({
        rotate: phaseOneTarget,
        transition: { duration: PHASE_ONE_DURATION_S, ease: [0.4, 0.0, 1, 1] }
      }),
      runTickLoop(0, phaseOneTarget, PHASE_ONE_DURATION_S, 'phase1', spinRunId)
    ]);

    if (spinRunIdRef.current !== spinRunId) return;

    await Promise.all([
      controls.start({
        rotate: phaseTwoTarget,
        transition: { duration: PHASE_TWO_DURATION_S, ease: 'linear' }
      }),
      runTickLoop(phaseOneTarget, phaseTwoTarget, PHASE_TWO_DURATION_S, 'phase2', spinRunId)
    ]);

    if (spinRunIdRef.current !== spinRunId) return;

    setIsFastPhase(false);
    await Promise.all([
      controls.start({
        rotate: totalRotation,
        transition: { duration: PHASE_THREE_DURATION_S, ease: [0.1, 0.8, 0.2, 1] }
      }),
      runTickLoop(phaseTwoTarget, totalRotation, PHASE_THREE_DURATION_S, 'phase3', spinRunId)
    ]);

    if (spinRunIdRef.current !== spinRunId) return;

    await new Promise((resolve) => window.setTimeout(resolve, RESULT_SUSPENSE_DELAY_MS));
    if (spinRunIdRef.current !== spinRunId) return;
    onFinish(isWin);
  };

  useEffect(() => () => {
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
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
        <span className="text-3xl font-black text-white">{chance.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chance</span>
      </div>

      <motion.div
        animate={controls}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <div
          className="w-1 h-10 bg-white rounded-full mt-[-4px] relative shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-[filter] duration-150"
          style={{ filter: isFastPhase ? 'blur(2px)' : 'blur(0px)' }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 rounded-sm" />
        </div>
      </motion.div>

      <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute inset-[-10px] rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
};
