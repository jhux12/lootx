import React, { useEffect, useRef } from 'react';
import pullzLogo from '../assets/pullz-p.PNG';

type BrandLockupProps = {
  className?: string;
  logoClassName?: string;
  logoWidth?: number;
  logoHeight?: number;
  textClassName?: string;
  dotClassName?: string;
  showText?: boolean;
  showTextOnMobile?: boolean;
};

const MAGNET_PULSE_INTERVAL_MS = 10_000;

export const BrandLockup: React.FC<BrandLockupProps> = ({
  className = '',
  logoClassName = 'h-12 w-auto md:h-14 lg:h-16',
  logoWidth = 500,
  logoHeight = 250,
  textClassName = 'text-lg md:text-xl',
  dotClassName = 'text-sm md:text-base',
  showText = true,
  showTextOnMobile = false,
}) => {
  const logoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const logoElement = logoRef.current;
    if (!logoElement || !('animate' in logoElement)) return undefined;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const playMagnetPull = () => {
      if (reducedMotionQuery.matches) return;

      logoElement.animate(
        [
          { transform: 'translateX(0) scale(1)', filter: 'drop-shadow(0 0 0 rgba(113, 113, 122, 0))' },
          { transform: 'translateX(-6px) scale(1.02)', filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.32))', offset: 0.16 },
          { transform: 'translateX(3px) scale(0.995)', filter: 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.18))', offset: 0.34 },
          { transform: 'translateX(-2px) scale(1.006)', filter: 'drop-shadow(0 0 4px rgba(96, 165, 250, 0.14))', offset: 0.56 },
          { transform: 'translateX(0) scale(1)', filter: 'drop-shadow(0 0 0 rgba(113, 113, 122, 0))' },
        ],
        {
          duration: 900,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
    };

    playMagnetPull();
    const interval = window.setInterval(playMagnetPull, MAGNET_PULSE_INTERVAL_MS);

    const handleMotionPreferenceChange = () => {
      if (reducedMotionQuery.matches) {
        logoElement.getAnimations().forEach((animation) => animation.cancel());
      }
    };

    reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange);

    return () => {
      window.clearInterval(interval);
      reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange);
      logoElement.getAnimations().forEach((animation) => animation.cancel());
    };
  }, []);

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`.trim()}>
      <img
        ref={logoRef}
        src={pullzLogo}
        alt="PULLZ Logo"
        width={logoWidth}
        height={logoHeight}
        className={`${logoClassName} shrink-0 object-contain will-change-transform`}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: '2 / 1' }}
      />
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
