import React from 'react';
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

export const BrandLockup: React.FC<BrandLockupProps> = ({
  className = '',
  logoClassName = 'h-12 w-auto md:h-14 lg:h-16',
  logoWidth = 500,
  logoHeight = 250,
  textClassName = 'text-lg md:text-xl',
  dotClassName = 'text-sm md:text-base',
  showText = true,
  showTextOnMobile = false,
}) => (
  <div className={`flex items-center justify-center gap-3 ${className}`.trim()}>
    <img
      src={pullzLogo}
      alt="PULLZ Logo"
      width={logoWidth}
      height={logoHeight}
      className={`${logoClassName} shrink-0 object-contain`}
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
