import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import type { View } from '../types';

type HomeBanner = {
  title: string;
  description: string;
  image: string;
  cta: string;
  view: View;
};

const HOME_BANNERS: HomeBanner[] = [
  {
    title: 'Open mystery boxes',
    description: 'Browse featured boxes and reveal collectible pulls in seconds.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/open.png?alt=media&token=34515af9-0309-412b-95fe-fb22837fd060',
    cta: 'Open boxes',
    view: { type: 'BOXES' }
  },
  {
    title: 'Upgrade your items',
    description: 'Use the upgrader to chase higher-value rewards from your inventory.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/upgrade.png?alt=media&token=41935126-5d8f-4430-ae63-e6e47713e793',
    cta: 'Try upgrader',
    view: { type: 'PLINKO' }
  },
  {
    title: 'Climb the ranks',
    description: 'Compete for the top spot and track the biggest Pullz players on the leaderboard.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/leader.png?alt=media&token=d1904a5a-5b16-4b67-b23d-4b307dc72136',
    cta: 'View leaderboard',
    view: { type: 'LEADERBOARD' }
  }
];

const ROTATION_INTERVAL_MS = 5500;

export const HomeBanners: React.FC = () => {
  const { setView } = useGame();
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

  const handleBannerAction = (banner: HomeBanner) => {
    setView(banner.view);
    if (banner.view.type === 'BOXES' && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/boxes');
    }
  };

  useEffect(() => {
    if (isPaused || HOME_BANNERS.length <= 1) return;
    const rotationTimer = window.setInterval(goToNextSlide, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(rotationTimer);
  }, [goToNextSlide, isPaused]);

  if (HOME_BANNERS.length === 0) {
    return null;
  }

  return (
    <section aria-label="Pullz feature highlights" className="relative">
      <div
        className="group relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#20262b]/72 shadow-[0_18px_44px_rgba(5,8,12,0.28)]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Open, upgrade, and leaderboard highlights"
      >
        <div className="relative min-h-[255px] sm:min-h-[285px] lg:min-h-[310px]">
          {HOME_BANNERS.map((banner, index) => {
            const isActive = index === activeIndex;
            const slideClassName = `absolute inset-0 transition-all duration-700 ease-out ${isActive ? 'z-10 translate-x-0 opacity-100' : 'z-0 translate-x-4 opacity-0'}`;

            return (
              <button
                key={banner.title}
                type="button"
                onClick={() => handleBannerAction(banner)}
                className={`${slideClassName} block h-full w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#20262b]`}
                aria-label={`${banner.title}: ${banner.cta}`}
                aria-hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.30),transparent_56%),radial-gradient(circle_at_25%_15%,rgba(32,93,215,0.22),transparent_46%),radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.14),transparent_42%)]" />
                <div className="relative grid h-full min-h-[255px] grid-cols-1 gap-2 p-5 sm:min-h-[285px] sm:grid-cols-[1fr_260px] sm:items-center sm:gap-6 sm:p-6 lg:min-h-[310px] lg:grid-cols-[1fr_340px] lg:p-7">
                  <div className="relative z-10 max-w-xl pb-24 sm:pb-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/85">Featured on Pullz</p>
                    <h2 className="mt-2 text-3xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-4xl lg:text-5xl">{banner.title}</h2>
                    <p className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-300 sm:text-base">{banner.description}</p>
                    <span className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-400 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_30px_rgba(32,93,215,0.34)] transition group-hover:brightness-110 sm:text-sm">
                      {banner.cta}
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-[-22px] right-[-18px] z-10 h-[178px] w-[178px] sm:static sm:h-[250px] sm:w-[250px] lg:h-[315px] lg:w-[315px]">
                    <img
                      src={banner.image}
                      alt={`${banner.title} artwork`}
                      className="h-full w-full -rotate-12 object-contain drop-shadow-[0_20px_36px_rgba(0,0,0,0.4)] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-[15deg]"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : 'low'}
                      decoding="async"
                      width={500}
                      height={500}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/45 via-black/12 to-transparent p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md">
            {HOME_BANNERS.map((banner, index) => (
              <button
                key={banner.title}
                type="button"
                onClick={() => goToSlide(index)}
                className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-7 bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.75)]' : 'w-2.5 bg-white/45 hover:bg-white/70'}`}
                aria-label={`Show ${banner.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={goToPreviousSlide}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:border-cyan-200/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              aria-label="Previous feature highlight"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goToNextSlide}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:border-cyan-200/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              aria-label="Next feature highlight"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
