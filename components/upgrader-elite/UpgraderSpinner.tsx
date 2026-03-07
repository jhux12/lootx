import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LucideCheckCircle2, LucideRefreshCw, LucideXCircle } from 'lucide-react';
import { UpgradeStatus } from './types';

export const needlePhysics = { overshootDeg: 6, settleMs: 520, damping: 0.18, frequency: 14 };

const TRAIL_GHOST_COUNT = 8;

const getRiskColor = (chance: number) => {
  if (chance < 20) return '#ef4444';
  if (chance < 50) return '#a855f7';
  if (chance < 80) return '#22d3ee';
  return '#22c55e';
};

const angleFromTransform = (node: HTMLElement) => {
  const transform = window.getComputedStyle(node).transform;
  if (!transform || transform === 'none') return 0;
  const matrix = new DOMMatrixReadOnly(transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
};

interface UpgraderSpinnerProps {
  chance: number;
  status: UpgradeStatus;
  spinRotation: number;
  spinNonce: number;
  spinSuccess: boolean | null;
  onSpinComplete: (success: boolean) => void;
  winZoneRotation: number;
  onWinZoneRotationChange: (rotation: number) => void;
  canRotateWinZone: boolean;
  reducedMotion: boolean;
  size?: number;
  durationMs?: number;
}

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = React.memo(({
  chance,
  status,
  spinRotation,
  spinNonce,
  spinSuccess,
  onSpinComplete,
  winZoneRotation,
  onWinZoneRotationChange,
  canRotateWinZone,
  reducedMotion,
  size = 280,
  durationMs = 4200
}) => {
  const handledNonceRef = useRef<number>(-1);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const needleRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const flickerTimeoutRef = useRef<number | null>(null);
  const flickerResetRef = useRef<number | null>(null);
  const trailRafRef = useRef<number | null>(null);
  const bounceRafRef = useRef<number | null>(null);
  const ghostNeedleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const historyRef = useRef<number[]>(Array(TRAIL_GHOST_COUNT).fill(0));
  const [spinBounceOffset, setSpinBounceOffset] = useState(0);
  const [isTrailing, setIsTrailing] = useState(false);

  const chanceGlowRgb = useMemo(() => {
    if (chance < 30) return '190, 50, 70';
    if (chance < 60) return '217, 119, 6';
    return '16, 185, 129';
  }, [chance]);

  const circumference = Math.PI * 2 * ((size - 20) / 2);
  const offset = circumference - (Math.max(0, Math.min(100, chance)) / 100) * circumference;
  const riskColor = useMemo(() => getRiskColor(chance), [chance]);

  const wheelCenter = useMemo(() => ({ x: size / 2, y: size / 2 }), [size]);

  useEffect(() => {
    const clearFlickerTimers = () => {
      if (flickerTimeoutRef.current) {
        window.clearTimeout(flickerTimeoutRef.current);
        flickerTimeoutRef.current = null;
      }
      if (flickerResetRef.current) {
        window.clearTimeout(flickerResetRef.current);
        flickerResetRef.current = null;
      }
    };

    clearFlickerTimers();
    wheelRef.current?.classList.remove('reactor-flicker');

    if (status !== 'idle') {
      return clearFlickerTimers;
    }

    let isCancelled = false;
    const runFlicker = () => {
      if (isCancelled || !wheelRef.current) return;

      wheelRef.current.classList.add('reactor-flicker');

      flickerResetRef.current = window.setTimeout(() => {
        wheelRef.current?.classList.remove('reactor-flicker');
      }, 120 + Math.floor(Math.random() * 80));

      flickerTimeoutRef.current = window.setTimeout(runFlicker, 2000 + Math.floor(Math.random() * 2000));
    };

    flickerTimeoutRef.current = window.setTimeout(runFlicker, 2000 + Math.floor(Math.random() * 2000));

    return () => {
      isCancelled = true;
      clearFlickerTimers();
      wheelRef.current?.classList.remove('reactor-flicker');
    };
  }, [status]);

  const updateRotationFromEvent = (clientX: number, clientY: number) => {
    const wheelElement = wheelRef.current;
    if (!wheelElement) return;
    const rect = wheelElement.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const angle = Math.atan2(localY - wheelCenter.y, localX - wheelCenter.x);
    const normalized = ((angle * 180) / Math.PI + 90 + 360) % 360;
    onWinZoneRotationChange(normalized);
  };

  useEffect(() => {
    if (status !== 'spinning' || reducedMotion) {
      setIsTrailing(false);
      if (trailRafRef.current) {
        window.cancelAnimationFrame(trailRafRef.current);
        trailRafRef.current = null;
      }
      return;
    }

    setIsTrailing(true);

    const frame = () => {
      if (!needleRef.current) return;
      const currentAngle = angleFromTransform(needleRef.current);
      historyRef.current = [currentAngle, ...historyRef.current.slice(0, TRAIL_GHOST_COUNT - 1)];
      ghostNeedleRefs.current.forEach((ghost, index) => {
        if (!ghost) return;
        const sampledAngle = historyRef.current[Math.min(TRAIL_GHOST_COUNT - 1, (index + 1) * 1)] ?? currentAngle;
        ghost.style.transform = `rotate(${sampledAngle}deg)`;
      });
      trailRafRef.current = window.requestAnimationFrame(frame);
    };

    trailRafRef.current = window.requestAnimationFrame(frame);
    return () => {
      if (trailRafRef.current) {
        window.cancelAnimationFrame(trailRafRef.current);
        trailRafRef.current = null;
      }
      setIsTrailing(false);
    };
  }, [reducedMotion, status, spinNonce]);

  const runNeedlePhysicsBounce = (onSettled: () => void) => {
    if (reducedMotion) {
      setSpinBounceOffset(0);
      onSettled();
      return;
    }

    const start = performance.now();
    const initial = needlePhysics.overshootDeg;
    const settleSeconds = needlePhysics.settleMs / 1000;

    const frame = (now: number) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(1, elapsed / settleSeconds);
      const oscillation = Math.cos(needlePhysics.frequency * elapsed);
      const envelope = Math.exp(-needlePhysics.damping * needlePhysics.frequency * elapsed * 2);
      const offsetDeg = initial * envelope * oscillation;
      setSpinBounceOffset(progress >= 1 ? 0 : offsetDeg);

      if (progress >= 1) {
        setSpinBounceOffset(0);
        onSettled();
        return;
      }

      bounceRafRef.current = window.requestAnimationFrame(frame);
    };

    bounceRafRef.current = window.requestAnimationFrame(frame);
  };

  useEffect(() => () => {
    if (trailRafRef.current) window.cancelAnimationFrame(trailRafRef.current);
    if (bounceRafRef.current) window.cancelAnimationFrame(bounceRafRef.current);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center py-4 sm:py-8">
      <div
        ref={wheelRef}
        className={`reactor-spinner relative touch-none ${status === 'idle' ? 'spinner-idle' : ''} ${canRotateWinZone ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ width: size, height: size, ['--reactor-glow-rgb' as string]: chanceGlowRgb, ['--reactor-risk-color' as string]: riskColor }}
        onPointerDown={(event) => {
          if (!canRotateWinZone || status !== 'idle') return;
          isDraggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateRotationFromEvent(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!isDraggingRef.current || !canRotateWinZone || status !== 'idle') return;
          updateRotationFromEvent(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <div
          className="reactor-energy-layer absolute inset-[10%] rounded-full pointer-events-none"
          style={{ animationPlayState: status === 'idle' ? 'running' : 'paused' }}
        />

        <div className="absolute inset-0 rounded-full">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={(size - 20) / 2}
              fill="transparent"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={20}
            />
            <g
              style={{
                transformOrigin: `${size / 2}px ${size / 2}px`,
                transform: `rotate(${winZoneRotation}deg)`
              }}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={(size - 20) / 2}
                fill="transparent"
                stroke="url(#win-gradient)"
                strokeWidth={20}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            </g>
            <defs>
              <linearGradient id="win-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {(status === 'idle' || status === 'spinning') && (
            <>
              <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{chance.toFixed(2)}%</span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold mt-1">Success Chance</p>
            </>
          )}
          {status === 'success' && (
            <>
              <LucideCheckCircle2 className="w-14 h-14 text-emerald-500 mb-2" />
              <span className="text-xl sm:text-2xl font-bold text-emerald-400 uppercase tracking-widest">Success</span>
            </>
          )}
          {status === 'fail' && (
            <>
              <LucideXCircle className="w-14 h-14 text-rose-500 mb-2" />
              <span className="text-xl sm:text-2xl font-bold text-rose-400 uppercase tracking-widest">Failed</span>
            </>
          )}
        </div>

        {Array.from({ length: TRAIL_GHOST_COUNT }).map((_, index) => (
          <div
            key={`ghost-${index}`}
            ref={(node) => {
              ghostNeedleRefs.current[index] = node;
            }}
            className={`absolute top-0 left-1/2 -ml-[2px] w-[4px] h-1/2 origin-bottom z-10 pointer-events-none will-change-transform reactor-needle-ghost ${isTrailing ? 'reactor-needle-ghost-active' : ''}`}
            style={{ opacity: (TRAIL_GHOST_COUNT - index) / (TRAIL_GHOST_COUNT * 10), filter: `blur(${index * 0.5}px)` }}
          >
            <div className="w-full h-full relative">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[var(--reactor-risk-color)]" />
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full"
                style={{ background: 'linear-gradient(to bottom, var(--reactor-risk-color), rgba(255,255,255,0.25), transparent)' }}
              />
            </div>
          </div>
        ))}

        <div
          ref={needleRef}
          onTransitionEnd={(event) => {
            if (event.propertyName !== 'transform') return;
            if (status !== 'spinning') return;
            if (handledNonceRef.current === spinNonce) return;
            handledNonceRef.current = spinNonce;
            runNeedlePhysicsBounce(() => onSpinComplete(Boolean(spinSuccess)));
          }}
          className="absolute top-0 left-1/2 -ml-[2px] w-[4px] h-1/2 origin-bottom z-20 pointer-events-none will-change-transform"
          style={{
            transform: `rotate(${spinRotation + spinBounceOffset}deg)`,
            transition: status === 'spinning' ? `transform ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none'
          }}
        >
          <div className={`w-full h-full relative reactor-needle ${isTrailing ? 'reactor-needle-trailing' : ''}`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)] border-4 border-[var(--reactor-risk-color)]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full bg-gradient-to-b from-white via-white/50 to-transparent" />
          </div>
        </div>
      </div>

      <div className="mt-5 h-8 flex items-center justify-center">
        {status === 'spinning' && (
          <div className="flex items-center gap-2 text-white/60 font-mono text-xs sm:text-sm">
            <LucideRefreshCw className="w-4 h-4 animate-spin" />
            <span>CALCULATING OUTCOME...</span>
          </div>
        )}
        {status === 'idle' && canRotateWinZone && (
          <div className="text-white/55 text-[10px] sm:text-xs uppercase tracking-[0.16em] font-semibold text-center px-4 leading-tight">
            <p>Rotate winning zone</p>
            <p className="text-white/40 text-[9px] sm:text-[10px] tracking-[0.12em] mt-1">Drag the ring</p>
          </div>
        )}
      </div>
    </div>
  );
});
