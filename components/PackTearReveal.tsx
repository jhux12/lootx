import React from 'react';
import { CaseItem } from '../types';

export type PackTearPhase = 'idle' | 'anticipation' | 'tearing' | 'revealed';

interface PackTearRevealProps {
  /** Artwork for the unopened pack (falls back gracefully if empty). */
  packImageUrl: string;
  /** Drives which stage of the animation is shown. Renders nothing when 'idle'. */
  phase: PackTearPhase;
  /** The item to reveal. Only its image/name are read, once phase reaches 'tearing' / 'revealed'. */
  item: CaseItem | null;
  /** Burst/glow color. Callers resolve this from their own rarity palette
   *  (already normalized against loose/server rarity strings) so this
   *  component doesn't need its own copy of that logic. */
  glowColor: string;
  /** Optional short tier label ("Legendary") shown above the item name. */
  rarityLabel?: string;
  /** Collapses every animation to effectively instant — for prefers-reduced-motion
   *  and low-power devices, not for the "quick spin" toggle (that just shortens
   *  how long each phase is held; the motion itself still plays). */
  reduceMotion?: boolean;
}

/**
 * Replaces the pack's charge/burst visual with a "tear open the pack" reveal:
 * the pack shakes, splits in half and flies apart, then the item art springs
 * in large and unboxed (no card frame) with a soft rarity glow and a holo
 * glint. Purely presentational — driven entirely by `phase`, so it never
 * touches spin timing, provably-fair locking, or win-modal logic. Renders as
 * an absolute overlay; the caller is responsible for showing the idle
 * (unopened) pack art before `phase` leaves 'idle'.
 *
 * Fills whatever box the caller sizes (see the stage container in
 * CaseOpening.tsx) rather than using fixed pixels, so it can be a large
 * "main stage" hero on every screen size without stretching the artwork —
 * every layer uses `object-fit: contain` / `background-size: contain` and
 * percentage-based transforms.
 */
export const PackTearReveal: React.FC<PackTearRevealProps> = ({
  packImageUrl,
  phase,
  item,
  glowColor,
  rarityLabel,
  reduceMotion = false
}) => {
  if (phase === 'idle') return null;

  const isTornStage = phase === 'tearing' || phase === 'revealed';

  return (
    <div
      className={`pullz-tear-overlay absolute inset-0 z-50 flex items-center justify-center ${reduceMotion ? 'pullz-tear-reduced' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={phase === 'revealed' && item ? `You got ${item.name}` : 'Opening pack'}
    >
      <div className="pullz-tear-scene">
        <div
          className={`pullz-tear-burst ${isTornStage ? 'go' : ''}`}
          style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
          aria-hidden="true"
        />

        <div
          className={`pullz-tear-half top ${isTornStage ? 'torn' : phase === 'anticipation' ? 'shaking' : ''}`}
          style={{ backgroundImage: packImageUrl ? `url(${packImageUrl})` : undefined }}
          aria-hidden="true"
        />
        <div
          className={`pullz-tear-half bottom ${isTornStage ? 'torn' : phase === 'anticipation' ? 'shaking' : ''}`}
          style={{ backgroundImage: packImageUrl ? `url(${packImageUrl})` : undefined }}
          aria-hidden="true"
        />

        <div className={`pullz-tear-card ${phase === 'revealed' ? 'show' : ''}`}>
          <div
            className="pullz-tear-glow"
            style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 72%)` }}
            aria-hidden="true"
          />
          {item?.image ? (
            <img src={item.image} alt={item.name} className="pullz-tear-card-img" draggable={false} />
          ) : null}
          <div className="pullz-tear-holo" aria-hidden="true" />
        </div>

        {phase === 'revealed' && item ? (
          <div className="pullz-tear-label">
            {rarityLabel ? (
              <span className="pullz-tear-label-tier" style={{ color: glowColor }}>{rarityLabel}</span>
            ) : null}
            <span className="pullz-tear-label-name">{item.name}</span>
          </div>
        ) : null}
      </div>

      <style>{`
        /* Sizing comes entirely from the caller's stage container (the overlay
           is inset:0 within it); this just fills whatever box it's given. */
        .pullz-tear-scene {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .pullz-tear-burst {
          position: absolute; left: 50%; top: 50%; width: 55%; height: 55%;
          border-radius: 50%; transform: translate(-50%, -50%) scale(0); opacity: 0; pointer-events: none;
          will-change: transform, opacity;
        }
        .pullz-tear-burst.go { animation: pullzTearBurst 900ms cubic-bezier(.2,.9,.3,1) forwards; }
        @keyframes pullzTearBurst {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
        }
        .pullz-tear-half {
          position: absolute; inset: 0; background-color: #11182a;
          background-size: contain; background-repeat: no-repeat; background-position: center;
          border-radius: 12px; box-shadow: 0 18px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
          backface-visibility: hidden; -webkit-backface-visibility: hidden; will-change: transform, opacity;
        }
        .pullz-tear-half.top { clip-path: polygon(0 0, 100% 0, 100% 48%, 0 52%); }
        .pullz-tear-half.bottom { clip-path: polygon(0 52%, 100% 48%, 100% 100%, 0 100%); }
        .pullz-tear-half.shaking { animation: pullzTearShake 420ms ease-in-out infinite; }
        @keyframes pullzTearShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-3px, 1px) rotate(-1.5deg); }
          75% { transform: translate(3px, 1px) rotate(1.5deg); }
        }
        .pullz-tear-half.top.torn { animation: pullzTearTop 560ms cubic-bezier(.4,0,.2,1) forwards; }
        .pullz-tear-half.bottom.torn { animation: pullzTearBottom 560ms cubic-bezier(.4,0,.2,1) forwards; }
        @keyframes pullzTearTop {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(0, -95%) rotate(-26deg); opacity: 0; }
        }
        @keyframes pullzTearBottom {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(0, 95%) rotate(18deg); opacity: 0; }
        }
        .pullz-tear-card {
          position: absolute; inset: 6%;
          transform: scale(0.4); opacity: 0;
          display: flex; align-items: center; justify-content: center;
          will-change: transform, opacity;
        }
        .pullz-tear-card.show { animation: pullzTearCardIn 560ms cubic-bezier(.2,.8,.25,1.15) forwards; }
        @keyframes pullzTearCardIn {
          0% { transform: scale(0.3) rotate(-6deg); opacity: 0; }
          60% { transform: scale(1.06) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .pullz-tear-glow {
          position: absolute; inset: -10%; z-index: 0;
          border-radius: 50%; filter: blur(28px); opacity: 0.55;
        }
        .pullz-tear-card-img {
          width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,0.55));
        }
        .pullz-tear-holo {
          position: absolute; inset: 0; overflow: hidden; z-index: 3; pointer-events: none;
        }
        .pullz-tear-holo::after {
          content: ""; position: absolute; top: -20%; bottom: -20%; left: -60%; width: 40%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent);
          transform: translateX(0);
        }
        .pullz-tear-card.show .pullz-tear-holo::after { animation: pullzTearSheen 1100ms 380ms ease-in-out; }
        @keyframes pullzTearSheen {
          from { transform: translateX(0); }
          to { transform: translateX(220%); }
        }
        .pullz-tear-label {
          position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 100%);
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          white-space: nowrap; text-align: center; padding-top: 14px;
          opacity: 0; animation: pullzTearLabelIn 360ms 500ms ease forwards;
        }
        .pullz-tear-label-tier {
          font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
        }
        .pullz-tear-label-name {
          font-size: 16px; font-weight: 700; letter-spacing: 0.2px; color: #fff;
        }
        @keyframes pullzTearLabelIn { to { opacity: 1; } }
        .pullz-tear-reduced .pullz-tear-half.torn,
        .pullz-tear-reduced .pullz-tear-card.show,
        .pullz-tear-reduced .pullz-tear-burst.go,
        .pullz-tear-reduced .pullz-tear-half.shaking,
        .pullz-tear-reduced .pullz-tear-card.show .pullz-tear-holo::after,
        .pullz-tear-reduced .pullz-tear-label {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
        }
      `}</style>
    </div>
  );
};
