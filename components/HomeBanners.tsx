import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import banner1 from '../assets/banner.png';
import banner2 from '../assets/banner2.png';

type HomeBanner = {
  src: string;
  alt: string;
  label: string;
  href?: string;
  action?: 'bonuses' | 'signup';
};

const HOME_BANNERS: HomeBanner[] = [
  {
    src: banner1,
    alt: 'Pullz featured mystery boxes promotion',
    label: 'Featured Mystery Boxes',
    href: '/boxes'
  },
  {
    src: banner2,
    alt: 'Pullz free box and rewards promotion',
    label: 'Free Box Rewards',
    action: 'bonuses'
  },
  {
    src: '/home-banners/homepage-preview.svg',
    alt: 'Pullz homepage hero preview artwork',
    label: 'Fair Value Guarantee',
    action: 'signup'
  }
];

const ROTATION_INTERVAL_MS = 5500;

export const HomeBanners: React.FC = () => {
  const { isAuthenticated, openAuthModal, setView } = useGame();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex((index + HOME_BANNERS.length) % HOME_BANNERS.length);
  }, []);

  const goToNextSlide = useCallback(() => {
    setActiveIndex((current) => (current + 1) % HOME_BANNERS.length);
  }, []);

  const goToPreviousSlide = useCallback(() => {
    setActiveIndex((current) => (current - 1 + HOME_BANNERS.length) % HOME_BANNERS.length);
  }, []);

  useEffect(() => {
    if (isPaused || HOME_BANNERS.length <= 1) return;
    const rotationTimer = window.setInterval(goToNextSlide, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(rotationTimer);
  }, [goToNextSlide, isPaused]);

  if (HOME_BANNERS.length === 0) {
    return null;
  }

  const handleBannerAction = (banner: HomeBanner) => {
    if (banner.action === 'bonuses') {
      if (!isAuthenticated) {
        openAuthModal('register');
        return;
      }
      setView({ type: 'BONUSES' });
      return;
    }

    if (banner.action === 'signup') {
      if (!isAuthenticated) {
        openAuthModal('register');
        return;
      }
      setView({ type: 'BOXES' });
    }
  };

  return (
    <section aria-label="Homepage hero promotions" className="relative">
      <div
        className="group relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#0c111b] shadow-[0_18px_44px_rgba(5,8,12,0.28)]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured Pullz promotions"
      >
        <div className="relative aspect-[16/9] min-h-[190px] sm:aspect-[16/6] sm:min-h-[260px] lg:aspect-[16/5]">
          {HOME_BANNERS.map((banner, index) => {
            const isActive = index === activeIndex;
            const content = (
              <>
                <img
                  src={banner.src}
                  alt={banner.alt}
                  className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.01]"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  width={1920}
                  height={600}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] ring-1 ring-white/10" />
              </>
            );

            const slideClassName = `absolute inset-0 transition-all duration-700 ease-out ${isActive ? 'z-10 translate-x-0 opacity-100' : 'z-0 translate-x-4 opacity-0'}`;

            if (banner.action) {
              return (
                <button
                  key={banner.src}
                  type="button"
                  onClick={() => handleBannerAction(banner)}
                  className={`${slideClassName} block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c111b]`}
                  aria-label={banner.label}
                  aria-hidden={!isActive}
                  tabIndex={isActive ? 0 : -1}
                >
                  {content}
                </button>
              );
            }

            if (banner.href) {
              const isExternal = banner.href.startsWith('http');
              return (
                <a
                  key={banner.src}
                  href={banner.href}
                  className={`${slideClassName} block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c111b]`}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
                  aria-label={banner.label}
                  aria-hidden={!isActive}
                  tabIndex={isActive ? 0 : -1}
                >
                  {content}
                </a>
              );
            }

            return (
              <div key={banner.src} className={slideClassName} aria-hidden={!isActive}>
                {content}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/45 via-black/12 to-transparent p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md">
            {HOME_BANNERS.map((banner, index) => (
              <button
                key={banner.src}
                type="button"
                onClick={() => goToSlide(index)}
                className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-7 bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.75)]' : 'w-2.5 bg-white/45 hover:bg-white/70'}`}
                aria-label={`Show ${banner.label}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={goToPreviousSlide}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:border-cyan-200/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              aria-label="Previous promotion"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goToNextSlide}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:border-cyan-200/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              aria-label="Next promotion"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
