import React from 'react';
import horizontalDarkLogo from '../assets/png/pullz-horizontal-dark-2400.png';
import horizontalLightLogo from '../assets/png/pullz-horizontal-light-2400.png';

type BrandLockupProps = {
  className?: string;
  logoClassName?: string;
  logoWidth?: number;
  logoHeight?: number;
  /** Retained for backwards-compatible call sites; the supplied wordmark includes the name. */
  textClassName?: string;
  dotClassName?: string;
  showText?: boolean;
  showTextOnMobile?: boolean;
  variant?: 'dark' | 'light';
};

/** A consistently sized Pullz wordmark for dark and light surfaces. */
export const BrandLockup: React.FC<BrandLockupProps> = ({
  className = '',
  logoClassName = 'h-10 w-auto md:h-12',
  logoWidth = 2400,
  logoHeight = 619,
  variant = 'dark',
}) => {
  const logo = variant === 'light' ? horizontalLightLogo : horizontalDarkLogo;

  return (
    <div className={`flex items-center justify-center ${className}`.trim()}>
      <img
        src={logo}
        alt="Pullz"
        width={logoWidth}
        height={logoHeight}
        className={`${logoClassName} shrink-0 object-contain`}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: '2400 / 619' }}
      />
    </div>
  );
};
