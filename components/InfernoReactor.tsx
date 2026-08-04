import React, { useMemo } from 'react';
import { CaseItem } from '../types';
import { BlurImage } from '../src/ui/images/BlurImage';

export type ReactorPhase = 'idle' | 'charging' | 'shaking' | 'bursting' | 'revealed';

interface InfernoReactorProps {
  boxImage: string;
  boxName: string;
  phase: ReactorPhase;
  revealItem: CaseItem | null;
  accentColor: string;
  isGoldStage: boolean;
  reduceEffects: boolean;
  className?: string;
}

const EMBER_COUNT_FULL = 10;
const EMBER_COUNT_REDUCED = 5;

const REACTOR_STYLES = `
  .reactor-stage { position: relative; width: min(320px, 78vw); height: 280px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
  .reactor-pedestal { position: absolute; bottom: 14%; left: 50%; transform: translateX(-50%); width: 56%; height: 14px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--reactor-accent) 45%, transparent), transparent 75%); filter: blur(3px); }

  .reactor-rings { position: absolute; inset: 0; margin: auto; width: 0; height: 0; pointer-events: none; }
  .reactor-rings span { position: absolute; top: 50%; left: 50%; width: 110px; height: 110px; margin: -55px 0 0 -55px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--reactor-accent) 55%, transparent); opacity: 0; }
  .reactor-rings.is-active span { animation: reactorRingExpand 1.15s ease-out infinite; }
  .reactor-rings.is-active span:nth-child(2) { animation-delay: .38s; }
  .reactor-rings.is-active span:nth-child(3) { animation-delay: .76s; }
  @keyframes reactorRingExpand {
    0% { width: 110px; height: 110px; margin: -55px 0 0 -55px; opacity: 0; }
    15% { opacity: .75; }
    100% { width: 300px; height: 300px; margin: -150px 0 0 -150px; opacity: 0; }
  }

  .reactor-embers { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .reactor-ember { position: absolute; bottom: 18%; border-radius: 50%; background: radial-gradient(circle, #ffe0b3, var(--reactor-accent) 60%, transparent 75%); opacity: 0; }
  .reactor-embers.is-active .reactor-ember { animation: reactorEmberFloat linear infinite; }
  @keyframes reactorEmberFloat {
    0% { opacity: 0; transform: translateY(0) scale(.6); }
    15% { opacity: .85; }
    85% { opacity: .35; }
    100% { opacity: 0; transform: translateY(-160px) scale(1); }
  }

  .reactor-rays {
    position: absolute; inset: 0; margin: auto; width: 340px; height: 340px; border-radius: 50%;
    background: conic-gradient(from 0deg,
      transparent 0deg, color-mix(in srgb, var(--reactor-accent) 30%, transparent) 10deg, transparent 22deg,
      transparent 46deg, color-mix(in srgb, var(--reactor-accent) 24%, transparent) 56deg, transparent 68deg,
      transparent 100deg, color-mix(in srgb, var(--reactor-accent) 28%, transparent) 110deg, transparent 122deg,
      transparent 154deg, color-mix(in srgb, var(--reactor-accent) 22%, transparent) 164deg, transparent 176deg,
      transparent 208deg, color-mix(in srgb, var(--reactor-accent) 28%, transparent) 218deg, transparent 230deg,
      transparent 262deg, color-mix(in srgb, var(--reactor-accent) 24%, transparent) 272deg, transparent 284deg,
      transparent 316deg, color-mix(in srgb, var(--reactor-accent) 28%, transparent) 326deg, transparent 338deg);
    opacity: 0; pointer-events: none;
  }
  .reactor-rays.is-active { opacity: 1; animation: reactorRaySpin 14s linear infinite; }
  @keyframes reactorRaySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .reactor-box-visibility { position: relative; z-index: 2; width: 180px; height: 180px; opacity: 0; transform: scale(.75) translateY(14px); transition: opacity 380ms ease, transform 420ms cubic-bezier(.3,.7,.4,1); }
  .reactor-box-visibility.is-visible { opacity: 1; transform: scale(1) translateY(0); }
  .reactor-box-pulse { width: 100%; height: 100%; animation: reactorBoxIdle 3.4s ease-in-out infinite; filter: drop-shadow(0 16px 26px rgba(0,0,0,0.55)); }
  .reactor-box-pulse.is-charging { animation: reactorBoxCharge 0.85s ease-in-out infinite; filter: drop-shadow(0 0 24px var(--reactor-accent)); }
  .reactor-box-pulse.is-shaking { animation: reactorShake 0.38s ease; }
  @keyframes reactorBoxIdle { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } }
  @keyframes reactorBoxCharge { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.05) rotate(.6deg); } }
  @keyframes reactorShake {
    0%, 100% { transform: translate(0,0) rotate(0); }
    15% { transform: translate(-6px,2px) rotate(-2deg); }
    30% { transform: translate(6px,-2px) rotate(2deg); }
    45% { transform: translate(-5px,1px) rotate(-1.5deg); }
    60% { transform: translate(5px,-1px) rotate(1.5deg); }
    75% { transform: translate(-3px,1px) rotate(-1deg); }
    90% { transform: translate(2px,0) rotate(.5deg); }
  }
  .reactor-box-art { width: 100%; height: 100%; object-fit: contain; }

  .reactor-flash { position: absolute; inset: -10%; margin: auto; width: 120%; height: 120%; border-radius: 50%; background: radial-gradient(circle, #fff6e8 0%, var(--reactor-accent) 32%, transparent 70%); opacity: 0; pointer-events: none; z-index: 3; }
  .reactor-flash.is-active { animation: reactorFlashPop .55s ease-out forwards; }
  @keyframes reactorFlashPop { 0% { opacity: 0; transform: scale(.3); } 22% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0; transform: scale(1.85); } }

  .reactor-item { position: absolute; z-index: 4; width: 170px; height: 170px; opacity: 0; transform: translateY(46px) scale(.4) rotate(-8deg); }
  .reactor-item-art { width: 100%; height: 100%; object-fit: contain; }
  [data-phase="bursting"] .reactor-item,
  [data-phase="revealed"] .reactor-item {
    animation: reactorItemRise .78s cubic-bezier(.19,1.2,.32,1) forwards;
  }
  @keyframes reactorItemRise {
    0% { opacity: 0; transform: translateY(52px) scale(.35) rotate(-8deg); }
    55% { opacity: 1; transform: translateY(-14px) scale(1.12) rotate(3deg); }
    100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
  }
  .reactor-item--gold .reactor-item-art { filter: drop-shadow(0 0 26px rgba(251,191,36,0.75)); }

  @media (prefers-reduced-motion: reduce) {
    .reactor-rings.is-active span,
    .reactor-embers.is-active .reactor-ember,
    .reactor-box-pulse,
    .reactor-box-pulse.is-charging,
    .reactor-box-pulse.is-shaking,
    .reactor-rays.is-active,
    .reactor-flash.is-active,
    [data-phase="bursting"] .reactor-item,
    [data-phase="revealed"] .reactor-item {
      animation: none !important;
    }
    .reactor-box-visibility { transition: opacity 120ms linear !important; transform: none !important; }
    [data-phase="bursting"] .reactor-item,
    [data-phase="revealed"] .reactor-item {
      opacity: 1;
      transform: none;
    }
  }
`;

export const InfernoReactor: React.FC<InfernoReactorProps> = ({
  boxImage,
  boxName,
  phase,
  revealItem,
  accentColor,
  isGoldStage,
  reduceEffects,
  className = ''
}) => {
  const emberCount = reduceEffects ? EMBER_COUNT_REDUCED : EMBER_COUNT_FULL;
  const embers = useMemo(() => Array.from({ length: emberCount }, (_, index) => ({
    left: 12 + ((index * 37) % 76),
    delay: (index * 0.37) % 2.6,
    duration: 2.2 + ((index * 0.53) % 1.6),
    size: 3 + (index % 3)
  })), [emberCount]);

  const isBoxVisible = phase === 'idle' || phase === 'charging' || phase === 'shaking';
  const isCharging = phase === 'charging';
  const isShaking = phase === 'shaking';
  const isBursting = phase === 'bursting';
  const isRevealed = phase === 'revealed';
  const showRays = isBursting || isRevealed;
  const showItem = (isBursting || isRevealed) && Boolean(revealItem);

  return (
    <div
      className={`reactor-stage ${className}`}
      data-phase={phase}
      style={{ '--reactor-accent': accentColor } as React.CSSProperties}
    >
      <style>{REACTOR_STYLES}</style>
      <div className="reactor-pedestal" aria-hidden="true" />
      <div className={`reactor-rings ${isCharging ? 'is-active' : ''}`} aria-hidden="true">
        <span /><span /><span />
      </div>
      <div className={`reactor-embers ${isCharging ? 'is-active' : ''}`} aria-hidden="true">
        {embers.map((ember, index) => (
          <span
            key={index}
            className="reactor-ember"
            style={{ left: `${ember.left}%`, width: ember.size, height: ember.size, animationDelay: `${ember.delay}s`, animationDuration: `${ember.duration}s` }}
          />
        ))}
      </div>
      <div className={`reactor-rays ${showRays ? 'is-active' : ''}`} aria-hidden="true" />
      <div className={`reactor-box-visibility ${isBoxVisible ? 'is-visible' : ''}`}>
        <div className={`reactor-box-pulse ${isCharging ? 'is-charging' : ''} ${isShaking ? 'is-shaking' : ''}`}>
          <BlurImage src={boxImage} alt={boxName} showPlaceholder={false} staticRender retryOnError={false} className="reactor-box-art" />
        </div>
      </div>
      <div className={`reactor-flash ${isBursting ? 'is-active' : ''}`} aria-hidden="true" />
      {showItem && revealItem && (
        <div className={`reactor-item ${isGoldStage ? 'reactor-item--gold' : ''}`}>
          <BlurImage src={revealItem.image} alt={revealItem.name} showPlaceholder={false} staticRender retryOnError={false} className="reactor-item-art" />
        </div>
      )}
    </div>
  );
};
