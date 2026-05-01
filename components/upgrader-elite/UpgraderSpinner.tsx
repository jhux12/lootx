import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LucideCheckCircle2, LucideRefreshCw, LucideXCircle } from 'lucide-react';
import { UpgradeStatus } from './types';

export const needlePhysics = { overshootDeg: 6, settleMs: 520, damping: 0.18, frequency: 14 };

const TRAIL_GHOST_COUNT = 8;
const MOBILE_TRAIL_GHOST_COUNT = 4;

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
  valueMultiplier?: number;
  hasSource: boolean;
  hasTarget: boolean;
  targetImage?: string;
  targetName?: string;
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
  mobileOptimized?: boolean;
}

interface SpinnerConfetti {
  id: number;
  angle: number;
  distance: number;
  size: number;
  hue: number;
  delay: number;
}

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = React.memo(({
  chance,
  valueMultiplier = 0,
  hasSource,
  hasTarget,
  targetImage,
  targetName,
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
  durationMs = 4200,
  mobileOptimized = false
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
  const [sweepNonce, setSweepNonce] = useState(0);
  const [confettiBurst, setConfettiBurst] = useState<SpinnerConfetti[]>([]);

  const chanceGlowRgb = useMemo(() => {
    if (chance >= 70) return '34, 197, 94';
    if (chance >= 40) return '245, 158, 11';
    return '239, 68, 68';
  }, [chance]);

  const circumference = Math.PI * 2 * ((size - 20) / 2);
  const offset = circumference - (Math.max(0, Math.min(100, chance)) / 100) * circumference;
  const riskColor = useMemo(() => getRiskColor(chance), [chance]);
  const wheelCenter = useMemo(() => ({ x: size / 2, y: size / 2 }), [size]);
  const multiplier = useMemo(() => {
    if (!Number.isFinite(valueMultiplier) || valueMultiplier <= 0) return '0.00';
    return valueMultiplier.toFixed(2);
  }, [valueMultiplier]);

  useEffect(() => {
    if (!hasSource || !hasTarget) return;
    setSweepNonce((previous) => previous + 1);
  }, [chance, hasSource, hasTarget]);

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
      const ghostCount = mobileOptimized ? MOBILE_TRAIL_GHOST_COUNT : TRAIL_GHOST_COUNT;
      historyRef.current = [currentAngle, ...historyRef.current.slice(0, ghostCount - 1)];
      ghostNeedleRefs.current.forEach((ghost, index) => {
        if (!ghost) return;
        const sampledAngle = historyRef.current[Math.min(ghostCount - 1, index + 1)] ?? currentAngle;
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

  useEffect(() => {
    if (status !== 'success') return;
    const burst = Array.from({ length: reducedMotion ? 12 : (mobileOptimized ? 14 : 32) }, (_, index) => ({
      id: index,
      angle: Math.random() * 360,
      distance: (size / 2) * (0.5 + Math.random() * 0.55),
      size: 5 + Math.random() * 6,
      hue: 160 + Math.random() * 170,
      delay: Math.random() * 120
    }));
    setConfettiBurst(burst);
    const timeoutId = window.setTimeout(() => setConfettiBurst([]), reducedMotion ? 900 : 1400);
    return () => window.clearTimeout(timeoutId);
  }, [mobileOptimized, reducedMotion, size, spinNonce, status]);

  return (
    <div className="relative flex flex-col items-center">
      <div
        ref={wheelRef}
        className={`relative touch-none rounded-full border border-violet-300/40 bg-[#050a16] shadow-[0_0_58px_rgba(79,70,229,0.3),inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-all duration-200 ${status === 'success' ? 'shadow-[0_0_70px_rgba(16,185,129,0.28),inset_0_0_0_1px_rgba(255,255,255,0.08)]' : ''} ${status === 'fail' ? 'shadow-[0_0_70px_rgba(244,63,94,0.24),inset_0_0_0_1px_rgba(255,255,255,0.08)]' : ''} ${canRotateWinZone ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
        <div className={`pointer-events-none absolute rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.3),rgba(56,189,248,0.08)_45%,transparent_70%)] ${mobileOptimized ? '-inset-4 blur-lg' : '-inset-8 blur-xl'}`} />
        <div className="pointer-events-none absolute inset-4 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(139,92,246,0.24),rgba(7,12,25,0.95)_70%)]" />
        <div className="pointer-events-none absolute inset-8 rounded-full border border-indigo-300/20 opacity-75" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)', backgroundSize: '14px 14px' }} />
        {hasSource && hasTarget && (
          <div
            key={sweepNonce}
            className="pointer-events-none absolute inset-2 rounded-full opacity-45"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, transparent 65%, rgba(147,197,253,0.6) 78%, transparent 90%)',
              animation: reducedMotion ? 'none' : 'upgraderSweep 520ms ease-out'
            }}
          />
        )}

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
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="45%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#e879f9" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex select-none flex-col items-center justify-center text-center [user-select:none]">
          {(status === 'idle' || status === 'spinning') && (
            <>
              {hasSource && hasTarget ? (
                <>
                  <p className="pointer-events-none text-[10px] font-semibold tracking-wide text-slate-300 sm:text-xs">{chance.toFixed(2)}%</p>
                  {targetImage && (
                    <img
                      src={targetImage}
                      alt={targetName ?? 'Target item'}
                      className="pointer-events-none mt-1 h-20 w-20 object-contain sm:h-24 sm:w-24"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="pointer-events-none mt-1 text-sm font-bold tracking-wide text-amber-300 sm:text-base">{multiplier}x</span>
                </>
              ) : (
                <>
                  <span className="px-8 text-center text-sm font-semibold leading-relaxed text-slate-300 sm:text-base">
                    Select items to see your chance
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
        {confettiBurst.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-30">
            {confettiBurst.map((piece) => (
              <span
                key={`${spinNonce}-${piece.id}`}
                className="absolute left-1/2 top-1/2 rounded-sm"
                style={{
                  width: `${piece.size}px`,
                  height: `${Math.max(3, piece.size * 0.55)}px`,
                  background: `hsl(${piece.hue} 98% 66%)`,
                  transform: 'translate(-50%, -50%)',
                  animation: reducedMotion ? 'none' : `spinnerConfetti 860ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                  animationDelay: `${piece.delay}ms`,
                  ['--confetti-x' as string]: `${Math.cos((piece.angle * Math.PI) / 180) * piece.distance}px`,
                  ['--confetti-y' as string]: `${Math.sin((piece.angle * Math.PI) / 180) * piece.distance}px`
                }}
              />
            ))}
          </div>
        )}

        {Array.from({ length: mobileOptimized ? MOBILE_TRAIL_GHOST_COUNT : TRAIL_GHOST_COUNT }).map((_, index) => (
          <div
            key={`ghost-${index}`}
            ref={(node) => {
              ghostNeedleRefs.current[index] = node;
            }}
            className={`pointer-events-none absolute left-1/2 top-0 z-10 -ml-[2px] h-1/2 w-[4px] origin-bottom will-change-transform ${isTrailing ? 'opacity-100' : 'opacity-0'}`}
            style={{ opacity: isTrailing ? ((mobileOptimized ? MOBILE_TRAIL_GHOST_COUNT : TRAIL_GHOST_COUNT) - index) / ((mobileOptimized ? MOBILE_TRAIL_GHOST_COUNT : TRAIL_GHOST_COUNT) * 9) : 0, filter: `blur(${index * 0.45}px)` }}
          >
            <div className="relative h-full w-full">
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
      <style>{`@keyframes upgraderSweep{from{transform:rotate(-22deg);opacity:.7}to{transform:rotate(18deg);opacity:0}}@keyframes spinnerConfetti{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + var(--confetti-x)),calc(-50% + var(--confetti-y) + 24px)) scale(.86) rotate(220deg);opacity:0}}`}</style>
    </div>
  );
});
