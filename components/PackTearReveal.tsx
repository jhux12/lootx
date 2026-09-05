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
  /** Burst/glow/card-border color. Callers resolve this from their own rarity
   *  palette (already normalized against loose/server rarity strings) so this
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
 * the pack shakes, splits in half and flies apart, then the item card springs
 * in with a holo sheen. Purely presentational — driven entirely by `phase`,
 * so it never touches spin timing, provably-fair locking, or win-modal logic.
 * Renders as an absolute overlay; the caller is responsible for showing the
 * idle (unopened) pack art before `phase` leaves 'idle'.
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
      className={`pullz-tear-overlay absolute inset-0 z-50 flex items-center justify-center bg-[linear-gradient(180deg,rgba(5,9,17,0.97),rgba(14,19,30,0.94)_50%,rgba(5,9,17,0.97))] ${reduceMotion ? 'pullz-tear-reduced' : ''}`}
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

        <div
          className={`pullz-tear-card ${phase === 'revealed' ? 'show' : ''}`}
          style={{ boxShadow: `0 0 0 1px ${glowColor}, 0 25px 55px rgba(0,0,0,0.55)` }}
        >
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
        .pullz-tear-scene { position: relative; width: 220px; height: 260px; }
        .pullz-tear-burst {
          position: absolute; left: 50%; top: 50%; width: 100px; height: 100px;
          border-radius: 50%; transform: translate(-50%, -50%) scale(0); opacity: 0; pointer-events: none;
          will-change: transform, opacity;
        }
        .pullz-tear-burst.go { animation: pullzTearBurst 900ms cubic-bezier(.2,.9,.3,1) forwards; }
        @keyframes pullzTearBurst {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(6); opacity: 0; }
        }
        .pullz-tear-half {
          position: absolute; left: 50%; top: 50%; width: 190px; height: 260px;
          transform: translate(-50%, -50%); background-color: #11182a;
          background-size: 190px 260px; background-repeat: no-repeat; background-position: center;
          border-radius: 12px; box-shadow: 0 18px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
          backface-visibility: hidden; -webkit-backface-visibility: hidden; will-change: transform, opacity;
        }
        .pullz-tear-half.top { clip-path: polygon(0 0, 100% 0, 100% 48%, 0 52%); }
        .pullz-tear-half.bottom { clip-path: polygon(0 52%, 100% 48%, 100% 100%, 0 100%); }
        .pullz-tear-half.shaking { animation: pullzTearShake 420ms ease-in-out infinite; }
        @keyframes pullzTearShake {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(calc(-50% - 3px), -50%) rotate(-1.5deg); }
          75% { transform: translate(calc(-50% + 3px), -50%) rotate(1.5deg); }
        }
        .pullz-tear-half.top.torn { animation: pullzTearTop 560ms cubic-bezier(.4,0,.2,1) forwards; }
        .pullz-tear-half.bottom.torn { animation: pullzTearBottom 560ms cubic-bezier(.4,0,.2,1) forwards; }
        @keyframes pullzTearTop {
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, calc(-50% - 200px)) rotate(-26deg); opacity: 0; }
        }
        @keyframes pullzTearBottom {
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, calc(-50% + 220px)) rotate(18deg); opacity: 0; }
        }
        .pullz-tear-card {
          position: absolute; left: 50%; top: 50%; width: 168px; height: 232px;
          transform: translate(-50%, -50%) scale(0.4); opacity: 0; border-radius: 14px;
          background: linear-gradient(160deg, #171c28, #0b0f18);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          will-change: transform, opacity;
        }
        .pullz-tear-card.show { animation: pullzTearCardIn 560ms cubic-bezier(.2,.8,.25,1.15) forwards; }
        @keyframes pullzTearCardIn {
          0% { transform: translate(-50%, -50%) scale(0.3) rotate(-6deg); opacity: 0; }
          60% { transform: translate(-50%, -50%) scale(1.06) rotate(2deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
        }
        .pullz-tear-card-img {
          width: 82%; height: 82%; object-fit: contain; position: relative; z-index: 2;
          filter: drop-shadow(0 8px 18px rgba(0,0,0,0.5));
        }
        .pullz-tear-holo {
          position: absolute; inset: 0;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0) 60%);
          transform: translateX(-120%); mix-blend-mode: overlay; z-index: 3;
        }
        .pullz-tear-card.show .pullz-tear-holo { animation: pullzTearSheen 1100ms 380ms ease-in-out; }
        @keyframes pullzTearSheen { to { transform: translateX(120%); } }
        .pullz-tear-label {
          position: absolute; left: 50%; bottom: -12px; transform: translate(-50%, 100%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          white-space: nowrap; text-align: center;
          opacity: 0; animation: pullzTearLabelIn 360ms 500ms ease forwards;
        }
        .pullz-tear-label-tier {
          font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
        }
        .pullz-tear-label-name {
          font-size: 13px; font-weight: 700; letter-spacing: 0.3px; color: #fff;
        }
        @keyframes pullzTearLabelIn { to { opacity: 1; } }
        .pullz-tear-reduced .pullz-tear-half.torn,
        .pullz-tear-reduced .pullz-tear-card.show,
        .pullz-tear-reduced .pullz-tear-burst.go,
        .pullz-tear-reduced .pullz-tear-half.shaking,
        .pullz-tear-reduced .pullz-tear-card.show .pullz-tear-holo,
        .pullz-tear-reduced .pullz-tear-label {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
        }
      `}</style>
    </div>
  );
};
