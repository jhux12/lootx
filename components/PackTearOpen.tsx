import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

interface PackTearOpenProps {
  imageSrc: string;
  onComplete: () => void;
  disabled?: boolean;
  accentColor?: string;
}

const HINT_STORAGE_KEY = 'pullz:pack-tear-hint-seen';
const SNAP_THRESHOLD = 0.35;
const JAG_POINT_COUNT = 24;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const PackTearOpen: React.FC<PackTearOpenProps> = ({
  imageSrc,
  onComplete,
  disabled = false,
  accentColor = '#22d3ee'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const jitterRef = useRef<number[]>([]);

  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isPointerSupported, setIsPointerSupported] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const clipPrefix = useId().replace(/:/g, '-');
  const wrapperClipId = `${clipPrefix}-wrapper-clip`;
  const insideClipId = `${clipPrefix}-inside-clip`;

  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animateTo = useCallback((target: number, duration = 240, done?: () => void) => {
    stopAnimation();
    const startValue = progressRef.current;
    const delta = target - startValue;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = clamp((now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValue + delta * eased;
      progressRef.current = next;
      setProgress(next);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        done?.();
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, [stopAnimation]);

  useEffect(() => {
    setIsPointerSupported(typeof window !== 'undefined' && 'PointerEvent' in window);
    if (typeof window === 'undefined') return;
    setShowHint(window.localStorage.getItem(HINT_STORAGE_KEY) !== '1');
  }, []);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(1, entry.contentRect.width);
      const height = Math.max(1, entry.contentRect.height);
      setSize({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
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

  useEffect(() => {
    if (jitterRef.current.length > 0) return;
    jitterRef.current = Array.from({ length: JAG_POINT_COUNT + 1 }, () => (Math.random() * 12) - 6);
  }, []);

  const setProgressFromX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const next = clamp((clientX - rect.left) / rect.width);
    progressRef.current = next;
    setProgress(next);

    if (showHint && next > 0.08 && typeof window !== 'undefined') {
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
      return;
    }

    animateTo(0, 220);
  }, [animateTo, completeTear]);

  const geometry = useMemo(() => {
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const seamStartY = 0.18 * height;
    const maxTearDepth = 0.55 * height;
    const tearY = seamStartY + (progress * maxTearDepth);
    const visibleTearY = progress <= 0.001 ? 0 : tearY;

    const points = Array.from({ length: JAG_POINT_COUNT + 1 }, (_, idx) => {
      const x = (idx / JAG_POINT_COUNT) * width;
      const jitter = jitterRef.current[idx] ?? 0;
      const y = clamp(visibleTearY + jitter, 0, height);
      return { x, y };
    });

    const leftY = points[0]?.y ?? visibleTearY;
    const rightY = points[points.length - 1]?.y ?? visibleTearY;
    const tearLine = `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')}`;

    const reversedPoints = [...points].reverse();
    const insidePath = [
      `M 0 0`,
      `L ${width.toFixed(2)} 0`,
      `L ${width.toFixed(2)} ${rightY.toFixed(2)}`,
      ...reversedPoints.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
      `L 0 ${leftY.toFixed(2)}`,
      'Z'
    ].join(' ');

    const wrapperPath = [
      `M 0 ${height.toFixed(2)}`,
      `L ${width.toFixed(2)} ${height.toFixed(2)}`,
      `L ${width.toFixed(2)} ${rightY.toFixed(2)}`,
      ...reversedPoints.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
      `L 0 ${leftY.toFixed(2)}`,
      'Z'
    ].join(' ');

    return {
      width,
      height,
      seamStartY,
      tearLine,
      insidePath,
      wrapperPath
    };
  }, [progress, size.height, size.width]);

  const flapLift = progress > 0.1 ? (progress - 0.1) * 26 : 0;
  const flapRotate = progress > 0.1 ? (progress - 0.1) * -13 : 0;

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
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id={insideClipId} clipPathUnits="userSpaceOnUse">
              <path d={geometry.insidePath} />
            </clipPath>
            <clipPath id={wrapperClipId} clipPathUnits="userSpaceOnUse">
              <path d={geometry.wrapperPath} />
            </clipPath>
          </defs>
        </svg>

        <div className="absolute inset-0" style={{ clipPath: `url(#${insideClipId})` }}>
          <div
            className="h-full w-full"
            style={{
              background: 'radial-gradient(circle at 50% 10%, rgba(56,189,248,0.22), rgba(11,18,30,0.94) 48%, rgba(2,6,14,0.98) 100%)'
            }}
          />
        </div>

        <div className="absolute inset-0" style={{ clipPath: `url(#${wrapperClipId})` }}>
          <img src={imageSrc} alt="Pack" className="h-full w-full object-contain p-5" draggable={false} />
        </div>

        <div
          className="absolute inset-x-0 top-0 overflow-hidden"
          style={{
            height: '22%',
            transform: `translateY(${-flapLift}px) rotate(${flapRotate}deg)`,
            transformOrigin: 'top center',
            transition: isDragging ? 'none' : 'transform 120ms linear',
            opacity: progress > 0.02 ? 1 : 0
          }}
          aria-hidden="true"
        >
          <img src={imageSrc} alt="" className="h-[455%] w-full object-contain p-5 pointer-events-none" draggable={false} />
        </div>

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
          {progress > 0.001 && (
            <path
              d={geometry.tearLine}
              stroke={accentColor}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${accentColor})` }}
            />
          )}
        </svg>

        {showHint && !disabled && progress < 0.1 && (
          <div className="pointer-events-none absolute left-0 right-0 top-[18%] h-[2px] overflow-hidden">
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
