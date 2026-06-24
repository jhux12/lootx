import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import type { ViewState } from '../types';
import { hasUserMadeDeposit } from '../utils/depositEligibility';

type HomeBanner = {
  title: string;
  eyebrow: string;
  description: string;
  image: string;
  cta: string;
  view?: ViewState;
  action?: 'claim-first-deposit';
  accent?: 'blue' | 'orange';
};

const FIRST_DEPOSIT_BANNER: HomeBanner = {
  title: 'Get a 50% Bonus on Your First Deposit',
  eyebrow: 'First deposit bonus',
  description: 'Deposit for the first time and receive 50% extra coins instantly. More coins means more boxes, more pulls.',
  image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/Announce.png?alt=media&token=9394b72b-d4f2-4207-9989-3e3dbb0e347e',
  cta: 'Claim bonus',
  action: 'claim-first-deposit',
  accent: 'orange'
};

const HOME_BANNERS: HomeBanner[] = [
  {
    title: 'Open mystery boxes',
    eyebrow: 'Featured on Pullz',
    description: 'Browse featured boxes and reveal collectible pulls in seconds.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/open.png?alt=media&token=34515af9-0309-412b-95fe-fb22837fd060',
    cta: 'Open boxes',
    view: { type: 'BOXES' },
    accent: 'blue'
  },
  {
    title: 'Upgrade your items',
    eyebrow: 'Featured on Pullz',
    description: 'Use the upgrader to chase higher-value rewards from your inventory.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/upgrade.png?alt=media&token=41935126-5d8f-4430-ae63-e6e47713e793',
    cta: 'Try upgrader',
    view: { type: 'PLINKO' },
    accent: 'blue'
  },
  {
    title: 'Climb the ranks',
    eyebrow: 'Featured on Pullz',
    description: 'Compete for the top spot and track the biggest Pullz players on the leaderboard.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/leader.png?alt=media&token=d1904a5a-5b16-4b67-b23d-4b307dc72136',
    cta: 'View leaderboard',
    view: { type: 'LEADERBOARD' },
    accent: 'blue'
  }
];

const ROTATION_INTERVAL_MS = 5500;
const MOBILE_CAROUSEL_QUERY = '(max-width: 639px)';

export const HomeBanners: React.FC = () => {
  const { isAuthenticated, user, setView, setShowTopUpModal, setTopUpModalIntent, openAuthModal } = useGame();
  const banners = useMemo(() => {
    const shouldShowFirstDepositOffer = !isAuthenticated || !hasUserMadeDeposit(user);
    return shouldShowFirstDepositOffer ? [FIRST_DEPOSIT_BANNER, ...HOME_BANNERS] : HOME_BANNERS;
  }, [isAuthenticated, user]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobileCarousel, setIsMobileCarousel] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(MOBILE_CAROUSEL_QUERY).matches));
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex((index + banners.length) % banners.length);
  }, [banners.length]);

  const goToNextSlide = useCallback(() => {
    setActiveIndex((current) => (current + 1) % banners.length);
  }, [banners.length]);

  const goToPreviousSlide = useCallback(() => {
    setActiveIndex((current) => (current - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const handleBannerAction = (banner: HomeBanner) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (banner.action === 'claim-first-deposit') {
      if (!isAuthenticated) {
        openAuthModal('login');
        return;
      }

      setTopUpModalIntent({
        reason: 'insufficient_balance',
        requiredCoins: 4000,
        currentBalance: Number(user.balance ?? 0),
        missingCoins: Math.max(0, 4000 - Number(user.balance ?? 0)),
        preferredPackageUsd: 20
      });
      setShowTopUpModal(true);
      return;
    }

    if (!banner.view) return;

    setView(banner.view);
    if (banner.view.type === 'BOXES' && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/boxes');
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length > 1) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      suppressNextClickRef.current = false;
      return;
    }

    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    suppressNextClickRef.current = false;
    setIsPaused(true);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.changedTouches.length > 1) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      setIsPaused(false);
      return;
    }

    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setIsPaused(false);

    if (startX === null || startY === null) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    suppressNextClickRef.current = true;
    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 350);
    if (deltaX < 0) goToNextSlide();
    else goToPreviousSlide();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileMediaQuery = window.matchMedia(MOBILE_CAROUSEL_QUERY);
    const syncMobileCarousel = () => setIsMobileCarousel(mobileMediaQuery.matches);
    syncMobileCarousel();
    mobileMediaQuery.addEventListener('change', syncMobileCarousel);
    return () => mobileMediaQuery.removeEventListener('change', syncMobileCarousel);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, banners.length - 1)));
  }, [banners.length]);

  useEffect(() => {
    if (isMobileCarousel || isPaused || banners.length <= 1) return;
    const rotationTimer = window.setInterval(goToNextSlide, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(rotationTimer);
  }, [banners.length, goToNextSlide, isMobileCarousel, isPaused]);

  if (banners.length === 0) {
    return null;
  }

  return (
    <section aria-label="Pullz feature highlights" className="relative">
      <div
        className="group relative overflow-hidden rounded-[1.15rem] border border-white/[0.08] bg-[#20262b]/72 shadow-[0_14px_34px_rgba(5,8,12,0.24)] select-none [touch-action:pan-y_pinch-zoom] sm:rounded-[1.25rem] sm:shadow-[0_16px_38px_rgba(5,8,12,0.26)]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="region"
        aria-roledescription="carousel"
        aria-label="Deposit offer, open, upgrade, and leaderboard highlights"
      >
        <div className="relative min-h-[210px] sm:min-h-[250px] lg:min-h-[280px]">
          {banners.map((banner, index) => {
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
                <div
                  className={
                    banner.accent === 'orange'
                      ? 'absolute inset-0 bg-[radial-gradient(circle_at_78%_68%,rgba(251,146,60,0.36),transparent_56%),radial-gradient(circle_at_22%_12%,rgba(249,115,22,0.30),transparent_46%),linear-gradient(135deg,rgba(120,53,15,0.50),rgba(32,38,43,0.76)_46%,rgba(15,23,42,0.84))]'
                      : 'absolute inset-0 bg-[radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.30),transparent_56%),radial-gradient(circle_at_25%_15%,rgba(32,93,215,0.22),transparent_46%),radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.14),transparent_42%)]'
                  }
                />
                <div className="relative grid h-full min-h-[210px] grid-cols-1 gap-2 p-4 sm:min-h-[250px] sm:grid-cols-[1fr_220px] sm:items-center sm:gap-5 sm:p-5 lg:min-h-[280px] lg:grid-cols-[1fr_295px] lg:p-6">
                  <div className="relative z-10 max-w-lg pb-20 sm:pb-0">
                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px] ${banner.accent === 'orange' ? 'text-orange-100/90' : 'text-cyan-200/85'}`}>{banner.eyebrow}</p>
                    <h2 className="mt-1.5 text-2xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-3xl lg:text-4xl">{banner.title}</h2>
                    <p className="mt-2 max-w-sm text-xs font-medium leading-5 text-slate-300 sm:max-w-md sm:text-sm sm:leading-6">{banner.description}</p>
                    <span className={`mt-4 inline-flex min-h-10 items-center rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition group-hover:brightness-110 sm:text-xs lg:text-sm ${banner.accent === 'orange' ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 shadow-[0_12px_30px_rgba(249,115,22,0.34)]' : 'bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-400 shadow-[0_12px_30px_rgba(32,93,215,0.34)]'}`}>
                      {banner.cta}
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-[-18px] right-[-14px] z-10 h-[136px] w-[136px] sm:static sm:h-[210px] sm:w-[210px] lg:h-[280px] lg:w-[280px]">
                    <img
                      src={banner.image}
                      alt={`${banner.title} artwork`}
                      className={`h-full w-full object-contain drop-shadow-[0_20px_36px_rgba(0,0,0,0.4)] transition-transform duration-500 ease-out group-hover:scale-105 ${banner.accent === 'orange' ? '-rotate-6 group-hover:-rotate-3' : '-rotate-12 group-hover:-rotate-[15deg]'}`}
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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/45 via-black/12 to-transparent p-2.5 sm:p-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur-md">
            {banners.map((banner, index) => (
              <button
                key={banner.title}
                type="button"
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all sm:h-2.5 ${index === activeIndex ? (banner.accent === 'orange' ? 'w-6 bg-orange-200 sm:w-7 shadow-[0_0_12px_rgba(254,215,170,0.75)]' : 'w-6 bg-cyan-200 sm:w-7 shadow-[0_0_12px_rgba(165,243,252,0.75)]') : 'w-2 bg-white/45 hover:bg-white/70 sm:w-2.5'}`}
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
