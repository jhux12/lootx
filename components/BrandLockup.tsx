import React from 'react';
import pullzLogo from '../assets/pullz-p.PNG';

type BrandLockupProps = {
  className?: string;
  logoClassName?: string;
  logoWidth?: number;
  logoHeight?: number;
  textClassName?: string;
  showText?: boolean;
  showTextOnMobile?: boolean;
};

export const BrandLockup: React.FC<BrandLockupProps> = ({
  className = '',
  logoClassName = 'h-12 md:h-14 lg:h-16',
  logoWidth = 500,
  logoHeight = 250,
  textClassName = 'text-lg md:text-xl',
  showText = true,
  showTextOnMobile = false,
}) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <img
      src={pullzLogo}
      alt="PULLZ Logo"
      width={logoWidth}
      height={logoHeight}
      className={`${logoClassName} object-contain`}
      loading="lazy"
      decoding="async"
      style={{ aspectRatio: "2 / 1" }}
    />
    {showText && (
      <span
        className={`items-baseline font-black uppercase tracking-[0.14em] text-white ${showTextOnMobile ? 'inline-flex' : 'hidden sm:inline-flex'} ${textClassName}`}
      >
        <span>PULLZ</span>
        <span className="ml-1 text-base md:text-lg font-semibold tracking-normal">.gg</span>
      </span>
    )}
  </div>
);
