import React from 'react';
import { CaseItem } from '../types';

export type PackTearPhase = 'idle' | 'tearing' | 'revealed';

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
 * The pack-open payoff: splits in half and flies apart with a radial burst,
 * then the item art springs in large and unboxed (no card frame) with a soft
 * rarity glow, a holo glint, and a name label anchored over the bottom of the
 * art. Purely presentational — driven entirely by `phase`, so it never
 * touches spin timing, provably-fair locking, or win-modal logic. Mounts
 * only once the caller is ready to tear (there's no separate "anticipation"
 * phase here — that lives in the caller as the pack zoom + slide-to-open);
 * renders as an absolute overlay filling whatever box the caller sizes, so
 * it can be a large "main stage" hero on every screen size without
 * stretching the artwork — every layer uses `object-fit: contain` /
 * `background-size: contain` and percentage-based transforms.
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

  return (
    <div
      className={`pullz-tear-overlay absolute inset-0 z-50 flex items-center justify-center ${reduceMotion ? 'pullz-tear-reduced' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={phase === 'revealed' && item ? `You got ${item.name}` : 'Opening pack'}
    >
      <div className="pullz-tear-scene">
        <div
          className="pullz-tear-burst go"
          style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
          aria-hidden="true"
        />

        <div
          className="pullz-tear-half top torn"
          style={{ backgroundImage: packImageUrl ? `url(${packImageUrl})` : undefined }}
          aria-hidden="true"
        />
        <div
          className="pullz-tear-half bottom torn"
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
          {phase === 'revealed' && item ? (
            <div className="pullz-tear-label">
              {rarityLabel ? (
                <span className="pullz-tear-label-tier" style={{ color: glowColor }}>{rarityLabel}</span>
              ) : null}
              <span className="pullz-tear-label-name">{item.name}</span>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        /* Sizing comes entirely from the caller's stage container (the overlay
           is inset:0 within it); this just fills whatever box it's given. */
        .pullz-tear-scene {
          position: relative;
          width: 100%;
          height: 100%;
          transform: translateZ(0);
        }
        .pullz-tear-burst {
          position: absolute; left: 50%; top: 50%; width: 55%; height: 55%;
          border-radius: 50%; transform: translate(-50%, -50%) scale(0); opacity: 0; pointer-events: none;
          will-change: transform, opacity;
        }
        .pullz-tear-burst.go { animation: pullzTearBurst 800ms cubic-bezier(.2,.9,.3,1) forwards; }
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
        .pullz-tear-half.top.torn { animation: pullzTearTop 480ms cubic-bezier(.4,0,.2,1) forwards; }
        .pullz-tear-half.bottom.torn { animation: pullzTearBottom 480ms cubic-bezier(.4,0,.2,1) forwards; }
        @keyframes pullzTearTop {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(0, -95%) rotate(-26deg); opacity: 0; }
        }
        @keyframes pullzTearBottom {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(0, 95%) rotate(18deg); opacity: 0; }
        }
        .pullz-tear-card {
          position: absolute; inset: 4%;
          transform: scale(0.4); opacity: 0;
          display: flex; align-items: center; justify-content: center;
          will-change: transform, opacity;
        }
        .pullz-tear-card.show { animation: pullzTearCardIn 480ms cubic-bezier(.2,.8,.25,1.15) forwards; }
        @keyframes pullzTearCardIn {
          0% { transform: scale(0.3) rotate(-6deg); opacity: 0; }
          62% { transform: scale(1.06) rotate(2deg); opacity: 1; }
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
        .pullz-tear-card.show .pullz-tear-holo::after { animation: pullzTearSheen 1000ms 320ms ease-in-out; }
        @keyframes pullzTearSheen {
          from { transform: translateX(0); }
          to { transform: translateX(220%); }
        }
        .pullz-tear-label {
          position: absolute; left: 0; right: 0; bottom: 0; z-index: 4;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          text-align: center; padding: 28px 10px 12px;
          background: linear-gradient(to top, rgba(5,8,14,0.75), transparent);
          border-radius: 0 0 14px 14px;
          opacity: 0; animation: pullzTearLabelIn 320ms 420ms ease forwards;
        }
        .pullz-tear-label-tier {
          font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
        }
        .pullz-tear-label-name {
          font-size: 15px; font-weight: 700; letter-spacing: 0.2px; color: #fff;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        @keyframes pullzTearLabelIn { to { opacity: 1; } }
        .pullz-tear-reduced .pullz-tear-half.torn,
        .pullz-tear-reduced .pullz-tear-card.show,
        .pullz-tear-reduced .pullz-tear-burst.go,
        .pullz-tear-reduced .pullz-tear-card.show .pullz-tear-holo::after,
        .pullz-tear-reduced .pullz-tear-label {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
        }
      `}</style>
    </div>
  );
};
