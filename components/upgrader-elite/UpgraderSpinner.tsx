import React, { useMemo, useRef } from 'react';
import { LucideCheckCircle2, LucideRefreshCw, LucideXCircle } from 'lucide-react';
import { UpgradeStatus } from './types';

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
  size = 280,
  durationMs = 4200
}) => {
  const handledNonceRef = useRef<number>(-1);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const circumference = Math.PI * 2 * ((size - 20) / 2);
  const offset = circumference - (Math.max(0, Math.min(100, chance)) / 100) * circumference;

  const wheelCenter = useMemo(() => ({ x: size / 2, y: size / 2 }), [size]);

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

  return (
    <div className="relative flex flex-col items-center justify-center py-4 sm:py-8">
      <div
        ref={wheelRef}
        className={`relative touch-none ${canRotateWinZone ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ width: size, height: size }}
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
                strokeLinecap="round"
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

        <div
          onTransitionEnd={(event) => {
            if (event.propertyName !== 'transform') return;
            if (status !== 'spinning') return;
            if (handledNonceRef.current === spinNonce) return;
            handledNonceRef.current = spinNonce;
            onSpinComplete(Boolean(spinSuccess));
          }}
          className="absolute top-0 left-1/2 -ml-[2px] w-[4px] h-1/2 origin-bottom z-20 pointer-events-none will-change-transform"
          style={{
            transform: `rotate(${spinRotation}deg)`,
            transition: status === 'spinning' ? `transform ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none'
          }}
        >
          <div className="w-full h-full relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)] border-4 border-emerald-500" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full bg-gradient-to-b from-white via-white/50 to-transparent" />
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-8 flex items-center justify-center px-3">
        {status === 'spinning' && (
          <div className="flex items-center gap-2 text-white/60 font-mono text-xs sm:text-sm">
            <LucideRefreshCw className="w-4 h-4 animate-spin" />
            <span>CALCULATING OUTCOME...</span>
          </div>
        )}
        {status === 'idle' && canRotateWinZone && (
          <div className="text-white/55 text-[10px] sm:text-xs uppercase tracking-[0.16em] font-semibold text-center leading-relaxed">
            Rotate winning zone
          </div>
        )}
      </div>
    </div>
  );
});
