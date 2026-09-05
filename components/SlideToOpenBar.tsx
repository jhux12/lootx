import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SlideToOpenBarProps {
  /** Fires once, either when the handle is dragged past the threshold or tapped. */
  onComplete: () => void;
  /** Track fill / handle icon color, usually the box or centered item's rarity color. */
  accentColor: string;
  label?: string;
}

const COMPLETE_THRESHOLD = 0.6;
const HANDLE_SIZE = 48;
const TRACK_PADDING = 3;

/**
 * A drag-or-tap "slide to open" control. Purely presentational: it knows
 * nothing about spin timing or odds, it just calls `onComplete` once, either
 * when the handle crosses the threshold or on a quick tap (so it never traps
 * a user who doesn't want to drag). Everything animates via transform/opacity
 * only — no layout properties change during drag — to stay smooth on phones.
 */
export const SlideToOpenBar: React.FC<SlideToOpenBarProps> = ({ onComplete, accentColor, label = 'Slide to open' }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const maxTravelRef = useRef(1);
  const startXRef = useRef(0);
  const draggedRef = useRef(false);
  const firedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const completeTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (completeTimerRef.current !== null) window.clearTimeout(completeTimerRef.current);
  }, []);

  const finish = useCallback((success: boolean) => {
    setDragging(false);
    if (success) {
      if (firedRef.current) return;
      firedRef.current = true;
      setCompleted(true);
      setProgress(1);
      completeTimerRef.current = window.setTimeout(onComplete, 140);
    } else {
      setProgress(0);
    }
  }, [onComplete]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (completed) return;
    const track = trackRef.current;
    if (!track) return;
    track.setPointerCapture(event.pointerId);
    maxTravelRef.current = Math.max(1, track.clientWidth - HANDLE_SIZE - TRACK_PADDING * 2);
    startXRef.current = event.clientX;
    draggedRef.current = false;
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || completed) return;
    const delta = event.clientX - startXRef.current;
    if (Math.abs(delta) > 4) draggedRef.current = true;
    setProgress(Math.min(1, Math.max(0, delta / maxTravelRef.current)));
  };

  const handlePointerUp = () => {
    if (!dragging || completed) return;
    finish(!draggedRef.current || progress >= COMPLETE_THRESHOLD);
  };

  const handleOffset = progress * maxTravelRef.current;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => finish(false)}
      onKeyDown={(event) => {
        if (completed) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          finish(true);
        }
      }}
      className="pullz-slide-track"
      style={{ '--slide-accent': accentColor } as React.CSSProperties}
    >
      <div
        className="pullz-slide-fill"
        style={{ transform: `scaleX(${Math.max(progress, completed ? 1 : 0)})`, transition: dragging ? 'none' : 'transform 280ms cubic-bezier(0.22,1,0.36,1)' }}
      />
      {!completed && (
        <span className="pullz-slide-label" style={{ opacity: Math.max(0, 1 - progress * 1.8) }}>
          {label}
        </span>
      )}
      <div
        className="pullz-slide-handle"
        style={{ transform: `translateX(${handleOffset}px)`, transition: dragging ? 'none' : 'transform 280ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0a0f19" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 5l7 7-7 7" />
        </svg>
      </div>

      <style>{`
        .pullz-slide-track {
          position: relative;
          height: 56px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          overflow: hidden;
          cursor: pointer;
          touch-action: pan-y;
          -webkit-user-select: none;
          user-select: none;
        }
        .pullz-slide-fill {
          position: absolute;
          inset: 0;
          transform-origin: left center;
          background: linear-gradient(90deg, color-mix(in srgb, var(--slide-accent) 55%, transparent), color-mix(in srgb, var(--slide-accent) 85%, transparent));
          will-change: transform;
        }
        .pullz-slide-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: rgba(255,255,255,0.9);
          pointer-events: none;
        }
        .pullz-slide-handle {
          position: absolute;
          top: ${TRACK_PADDING}px;
          left: ${TRACK_PADDING}px;
          width: ${HANDLE_SIZE}px;
          height: ${HANDLE_SIZE}px;
          border-radius: 9999px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          will-change: transform;
        }
        @media (prefers-reduced-motion: no-preference) {
          .pullz-slide-track:not(:active)::after {
            content: "";
            position: absolute;
            top: -20%;
            bottom: -20%;
            left: -30%;
            width: 30%;
            background: linear-gradient(100deg, transparent, rgba(255,255,255,0.16), transparent);
            animation: pullzSlideHint 2.2s ease-in-out infinite;
            pointer-events: none;
          }
        }
        @keyframes pullzSlideHint {
          0% { left: -30%; }
          100% { left: 120%; }
        }
      `}</style>
    </div>
  );
};
