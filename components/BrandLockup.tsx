import React, { useEffect, useState } from 'react';
import pullzLogo from '../assets/pullz-p.PNG';
import './brandLockup.css';

type BrandLockupProps = {
  className?: string;
  logoClassName?: string;
  logoWidth?: number;
  logoHeight?: number;
  textClassName?: string;
  dotClassName?: string;
  showText?: boolean;
  showTextOnMobile?: boolean;
  enableSignatureAnimation?: boolean;
  signatureIntervalRangeMs?: [number, number];
  signatureDurationMs?: number;
  initialSignatureDelayMs?: number;
};

export const BrandLockup: React.FC<BrandLockupProps> = ({
  className = '',
  logoClassName = 'h-12 w-auto md:h-14 lg:h-16',
  logoWidth = 500,
  logoHeight = 250,
  textClassName = 'text-lg md:text-xl',
  dotClassName = 'text-sm md:text-base',
  showText = true,
  showTextOnMobile = false,
  enableSignatureAnimation = false,
  signatureIntervalRangeMs = [6000, 12000],
  signatureDurationMs = 1450,
  initialSignatureDelayMs = 1400,
}) => {
  const [isSignatureActive, setIsSignatureActive] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReduceMotion(mediaQuery.matches);
    syncPreference();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncPreference);
      return () => mediaQuery.removeEventListener('change', syncPreference);
    }

    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, []);

  useEffect(() => {
    if (!enableSignatureAnimation || reduceMotion) {
      setIsSignatureActive(false);
      return;
    }

    const [minDelay, maxDelay] = signatureIntervalRangeMs;
    const safeMin = Math.max(1000, Math.min(minDelay, maxDelay));
    const safeMax = Math.max(safeMin, Math.max(minDelay, maxDelay));

    let triggerTimer: number | null = null;
    let settleTimer: number | null = null;
    let cancelled = false;

    const scheduleActivation = (delayOverride?: number) => {
      if (cancelled) return;
      const delay = typeof delayOverride === 'number'
        ? Math.max(0, delayOverride)
        : Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;

      triggerTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (typeof document !== 'undefined' && document.hidden) {
          scheduleActivation();
          return;
        }
        setIsSignatureActive(true);
        settleTimer = window.setTimeout(() => {
          if (cancelled) return;
          setIsSignatureActive(false);
          scheduleActivation();
        }, signatureDurationMs);
      }, delay);
    };

    scheduleActivation(initialSignatureDelayMs);

    return () => {
      cancelled = true;
      if (triggerTimer !== null) window.clearTimeout(triggerTimer);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [enableSignatureAnimation, reduceMotion, signatureDurationMs, signatureIntervalRangeMs, initialSignatureDelayMs]);

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`.trim()}>
      <span
        className={`pullz-logo-shell ${enableSignatureAnimation && !reduceMotion ? 'pullz-logo-shell--interactive' : ''} ${isSignatureActive ? 'pullz-logo-shell--active' : ''}`.trim()}
        style={{ ['--pullz-logo-signature-duration' as string]: `${signatureDurationMs}ms` }}
      >
        <img
          src={pullzLogo}
          alt="PULLZ Logo"
          width={logoWidth}
          height={logoHeight}
          className={`pullz-logo-image ${logoClassName} shrink-0 object-contain`}
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: '2 / 1' }}
        />
        {enableSignatureAnimation && !reduceMotion ? <span aria-hidden="true" className="pullz-logo-sweep" /> : null}
      </span>
      {showText && (
        <span
          className={`items-center font-black uppercase leading-none tracking-[0.18em] text-white ${showTextOnMobile ? 'inline-flex' : 'hidden sm:inline-flex'} ${textClassName}`.trim()}
        >
          <span className="block">PULLZ</span>
          <span className={`ml-1 inline-block translate-y-[1px] font-semibold tracking-[0.02em] text-white/90 ${dotClassName}`.trim()}>
            .gg
          </span>
        </span>
      )}
    </div>
  );
};
