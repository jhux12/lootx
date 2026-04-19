import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LucideCheckCircle2, LucideRefreshCw, LucideXCircle } from 'lucide-react';
import { UpgradeStatus } from './types';

export const needlePhysics = { overshootDeg: 6, settleMs: 520, damping: 0.18, frequency: 14 };

const TRAIL_GHOST_COUNT = 8;

const getRiskColor = (chance: number) => {
  if (chance >= 70) return '#22c55e';
  if (chance >= 40) return '#f59e0b';
  return '#ef4444';
};

const angleFromTransform = (node: HTMLElement) => {
  const transform = window.getComputedStyle(node).transform;
  if (!transform || transform === 'none') return 0;
  const matrix = new DOMMatrixReadOnly(transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
};

interface UpgraderSpinnerProps {
  chance: number;
  hasSource: boolean;
  hasTarget: boolean;
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
  hasSource,
  hasTarget,
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
  const trailRafRef = useRef<number | null>(null);
  const bounceRafRef = useRef<number | null>(null);
  const ghostNeedleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const historyRef = useRef<number[]>(Array(TRAIL_GHOST_COUNT).fill(0));
  const [spinBounceOffset, setSpinBounceOffset] = useState(0);
  const [isTrailing, setIsTrailing] = useState(false);
  const [animatedChance, setAnimatedChance] = useState(chance);

  const chanceGlowRgb = useMemo(() => {
    if (chance >= 70) return '34, 197, 94';
    if (chance >= 40) return '245, 158, 11';
    return '239, 68, 68';
  }, [chance]);

  const circumference = Math.PI * 2 * ((size - 20) / 2);
  const offset = circumference - (Math.max(0, Math.min(100, chance)) / 100) * circumference;
  const riskColor = useMemo(() => getRiskColor(chance), [chance]);
  const wheelCenter = useMemo(() => ({ x: size / 2, y: size / 2 }), [size]);
  const riskBand = useMemo(() => {
    if (chance >= 70) return { label: 'Safe', className: 'text-emerald-300' };
    if (chance >= 40) return { label: 'Balanced', className: 'text-amber-300' };
    return { label: 'High Risk', className: 'text-rose-300' };
  }, [chance]);

  useEffect(() => {
    const start = animatedChance;
    const end = chance;
    if (Math.abs(end - start) < 0.01) {
      setAnimatedChance(end);
      return;
    }

    const duration = reducedMotion ? 0 : 480;
    if (duration === 0) {
      setAnimatedChance(end);
      return;
    }

    const frameStart = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - frameStart) / duration);
      const eased = 1 - (1 - t) ** 3;
      setAnimatedChance(start + (end - start) * eased);
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [chance, reducedMotion]);

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
        const sampledAngle = historyRef.current[Math.min(TRAIL_GHOST_COUNT - 1, index + 1)] ?? currentAngle;
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
    <div className="relative flex flex-col items-center">
      <div
        ref={wheelRef}
        className={`relative touch-none rounded-full border border-indigo-300/30 bg-[#060b18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] ${canRotateWinZone ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
        <div className="pointer-events-none absolute inset-4 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.2),rgba(7,12,25,0.95)_70%)]" />
        <div className="pointer-events-none absolute inset-8 rounded-full border border-indigo-300/15 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)', backgroundSize: '14px 14px' }} />

        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={(size - 20) / 2} fill="transparent" stroke="rgba(255,255,255,0.09)" strokeWidth={16} />
          <g style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: `rotate(${winZoneRotation}deg)` }}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={(size - 20) / 2}
              fill="transparent"
              stroke="url(#win-gradient)"
              strokeWidth={16}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </g>
          <defs>
            <linearGradient id="win-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {(status === 'idle' || status === 'spinning') && (
            <>
              {hasSource && hasTarget ? (
                <>
                  <span className={`text-4xl font-bold tracking-tight sm:text-5xl ${riskBand.className}`}>{animatedChance.toFixed(2)}%</span>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Chance to upgrade</p>
                  <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskBand.className}`}>{riskBand.label}</p>
                </>
              ) : (
                <>
                  <span className="px-8 text-center text-base font-semibold leading-relaxed text-slate-300">
                    Pick both items to see your upgrade chance
                  </span>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Awaiting selections</p>
                </>
              )}
            </>
          )}
          {status === 'success' && (
            <>
              <LucideCheckCircle2 className="mb-2 h-14 w-14 text-emerald-400" />
              <span className="text-xl font-bold uppercase tracking-wider text-emerald-300">Success</span>
            </>
          )}
          {status === 'fail' && (
            <>
              <LucideXCircle className="mb-2 h-14 w-14 text-rose-400" />
              <span className="text-xl font-bold uppercase tracking-wider text-rose-300">Failed</span>
            </>
          )}
        </div>

        {Array.from({ length: TRAIL_GHOST_COUNT }).map((_, index) => (
          <div
            key={`ghost-${index}`}
            ref={(node) => {
              ghostNeedleRefs.current[index] = node;
            }}
            className={`pointer-events-none absolute left-1/2 top-0 z-10 -ml-[2px] h-1/2 w-[4px] origin-bottom will-change-transform ${isTrailing ? 'opacity-100' : 'opacity-0'}`}
            style={{ opacity: isTrailing ? (TRAIL_GHOST_COUNT - index) / (TRAIL_GHOST_COUNT * 9) : 0, filter: `blur(${index * 0.45}px)` }}
          >
            <div className="relative h-full w-full">
              <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--reactor-risk-color)]" />
              <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-gradient-to-b from-[var(--reactor-risk-color)] to-transparent" />
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
          className="pointer-events-none absolute left-1/2 top-0 z-20 -ml-[2px] h-1/2 w-[4px] origin-bottom will-change-transform"
          style={{
            transform: `rotate(${spinRotation + spinBounceOffset}deg)`,
            transition: status === 'spinning' ? `transform ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none'
          }}
        >
          <div className="relative h-full w-full">
            <div className="absolute -top-2 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-[var(--reactor-risk-color)] bg-white shadow-[0_0_15px_rgba(255,255,255,0.7)]" />
            <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-gradient-to-b from-white via-white/70 to-transparent" />
          </div>
        </div>
      </div>

      <div className="mt-3 h-6 text-center">
        {status === 'spinning' && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <LucideRefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>CALCULATING OUTCOME...</span>
          </div>
        )}
      </div>
    </div>
  );
});
