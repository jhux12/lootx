import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PackTearOpenProps {
  imageSrc: string;
  onComplete: () => void;
  disabled?: boolean;
  accentColor?: string;
}

const HINT_STORAGE_KEY = 'pullz:pack-tear-hint-seen';
const SNAP_THRESHOLD = 0.35;
const MAX_POINTS = 24;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const PackTearOpen: React.FC<PackTearOpenProps> = ({
  imageSrc,
  onComplete,
  disabled = false,
  accentColor = '#22d3ee'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const hasCompletedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isPointerSupported, setIsPointerSupported] = useState(true);

  const seamY = 24;
  const peelLift = progress * 24;
  const peelRotate = progress * -9;

  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animateTo = useCallback((target: number, duration = 240, done?: () => void) => {
    stopAnimation();
    const start = performance.now();
    const startValue = progressRef.current;
    const delta = target - startValue;

    const tick = (now: number) => {
      const t = clamp((now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValue + delta * eased;
      progressRef.current = next;
      setProgress(next);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        if (done) done();
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, [stopAnimation]);

  useEffect(() => {
    setIsPointerSupported(typeof window !== 'undefined' && 'PointerEvent' in window);
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(HINT_STORAGE_KEY) === '1';
    setShowHint(!seen);
  }, []);

  useEffect(() => {
    if (!disabled) return;
    stopAnimation();
    isDraggingRef.current = false;
    setIsDragging(false);
    progressRef.current = 0;
    setProgress(0);
    hasCompletedRef.current = false;
  }, [disabled, stopAnimation]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const setProgressFromX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = clamp((clientX - rect.left) / rect.width);
    progressRef.current = x;
    setProgress(x);

    if (showHint && x > 0.08 && typeof window !== 'undefined') {
      window.localStorage.setItem(HINT_STORAGE_KEY, '1');
      setShowHint(false);
    }
  }, [showHint]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const yRatio = (event.clientY - rect.top) / rect.height;
    if (yRatio > 0.25) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    setProgressFromX(event.clientX);
  }, [disabled, setProgressFromX]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return;
    setProgressFromX(event.clientX);
  }, [disabled, setProgressFromX]);

  const completeTear = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onComplete();
  }, [onComplete]);

  const endGesture = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (progressRef.current >= SNAP_THRESHOLD) {
      animateTo(1, 260, completeTear);
    } else {
      animateTo(0, 220);
    }
  }, [animateTo, completeTear]);

  const jaggedPath = useMemo(() => {
    const width = 100;
    const active = Math.max(5, width * progress);
    const points = Math.max(8, Math.floor(MAX_POINTS * progress));
    const step = active / points;

    const seamPoints: string[] = [];
    for (let i = 0; i <= points; i++) {
      const x = i * step;
      const noise = (Math.sin(i * 1.2) + Math.cos(i * 0.8)) * 1.5;
      seamPoints.push(`${x},${seamY + noise}`);
    }

    const topShape = [`M0,0`, `L${active},0`, `L${active},${seamY}`, ...seamPoints.reverse().map((p) => `L${p}`), 'L0,0', 'Z'];

    return {
      topClipPath: topShape.join(' '),
      seamStroke: `M0,${seamY} ` + seamPoints.map((point) => `L${point}`).join(' '),
      tearHeadX: active
    };
  }, [progress]);

  const particles = useMemo(() => {
    if (progress <= 0.05) return [];
    return Array.from({ length: 8 }, (_, idx) => ({
      key: idx,
      left: `${clamp(progress * 100 + (idx - 4) * 2, 1, 98)}%`,
      top: `${15 + (idx % 3) * 4}%`,
      opacity: clamp(progress * 1.2 - idx * 0.08, 0, 0.7)
    }));
  }, [progress]);

  return (
    <div className="w-full px-2 sm:px-4">
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#101722] shadow-[0_12px_40px_rgba(8,15,25,0.65)] aspect-[4/5] touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerLeave={() => {
          if (!isDraggingRef.current) return;
          endGesture();
        }}
        role="application"
        aria-label="Swipe to rip open pack"
      >
        <img src={imageSrc} alt="Pack" className="absolute inset-0 h-full w-full object-contain p-5" />

        <div
          className="absolute inset-0 origin-top"
          style={{
            transform: `translateY(${-peelLift}px) rotate(${peelRotate}deg)`,
            transformOrigin: 'top left',
            transition: isDragging ? 'none' : 'transform 120ms linear'
          }}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              <clipPath id="packTearClip" clipPathUnits="userSpaceOnUse">
                <path d={jaggedPath.topClipPath} />
              </clipPath>
            </defs>
            <image href={imageSrc} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" clipPath="url(#packTearClip)" />
            <path d={jaggedPath.seamStroke} stroke={accentColor} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.8))' }} />
          </svg>
        </div>

        <div
          className="absolute h-[2px] w-6 -translate-y-1/2 rounded-full"
          style={{
            left: `${jaggedPath.tearHeadX}%`,
            top: `${seamY}%`,
            background: accentColor,
            boxShadow: `0 0 12px ${accentColor}`,
            opacity: progress > 0.02 ? 1 : 0
          }}
          aria-hidden="true"
        />

        {particles.map((particle) => (
          <span
            key={particle.key}
            className="pointer-events-none absolute h-1 w-1 rounded-full"
            style={{ left: particle.left, top: particle.top, backgroundColor: accentColor, opacity: particle.opacity }}
          />
        ))}

        {showHint && !disabled && progress < 0.1 && (
          <div className="pointer-events-none absolute left-0 right-0 top-[20%] h-[2px] overflow-hidden">
            <div className="h-full w-16 animate-[tearHint_1.6s_ease-in-out_infinite] rounded-full bg-cyan-300/80" />
          </div>
        )}
      </div>

      {!isPointerSupported && !disabled && (
        <button
          type="button"
          onClick={() => animateTo(1, 260, completeTear)}
          className="mt-3 w-full rounded-lg border border-cyan-400/40 bg-cyan-500/15 py-2 text-sm font-semibold text-cyan-100"
        >
          Rip Open
        </button>
      )}

      <style>{`@keyframes tearHint { 0% { transform: translateX(-60px);} 50% { transform: translateX(calc(100% - 40px));} 100% { transform: translateX(-60px);} }`}</style>
    </div>
  );
};
