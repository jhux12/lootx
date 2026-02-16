import React, { useEffect, useMemo, useRef, useState } from 'react';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';
import { MysteryBox } from '../types';

type HeroProps = {
  demoBox?: MysteryBox;
};

type DemoReelItem = {
  id: string;
  name: string;
  image: string;
  price: number;
};

const CARD_WIDTH = 376;
const CARD_GAP = 8;
const STEP = CARD_WIDTH + CARD_GAP;
const REPEAT_COUNT = 6;
const CRUISE_SPEED = 130; // px/sec
const LANDING_EVERY_MS = 3200;
const LANDING_DURATION_MS = 950;
const LANDING_PAUSE_MS = 820;

const normalizeDemoItems = (box?: MysteryBox): DemoReelItem[] => {
  if (!box) return [];

  const mapped = (box.items ?? [])
    .slice(0, 12)
    .map((item, index) => ({
      id: item.id || `${box.id}-item-${index}`,
      name: item.name || `Item ${index + 1}`,
      image: item.image || box.image || '',
      price: Number.isFinite(item.price) ? item.price : Math.max(99, Math.round(box.price || 999))
    }))
    .filter((item) => item.image || item.name);

  if (mapped.length > 0) return mapped;

  return [
    {
      id: `${box.id}-fallback`,
      name: box.name || 'Featured Item',
      image: box.image || '',
      price: Math.max(99, Math.round(box.price || 999))
    }
  ];
};

export const Hero: React.FC<HeroProps> = ({ demoBox }) => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const xRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const modeRef = useRef<'cruise' | 'landing' | 'paused'>('cruise');
  const pauseUntilRef = useRef(0);
  const lastLandingAtRef = useRef(0);
  const landingStartXRef = useRef(0);
  const landingTargetXRef = useRef(0);
  const landingStartTimeRef = useRef(0);
  const currentFeaturedIndexRef = useRef(0);

  const baseItems = useMemo(() => normalizeDemoItems(demoBox), [demoBox]);

  const repeatedItems = useMemo(() => {
    if (baseItems.length === 0) return [] as Array<DemoReelItem & { sequenceId: string; baseIndex: number }>;
    return Array.from({ length: REPEAT_COUNT }, (_, repeatIndex) =>
      baseItems.map((item, baseIndex) => ({
        ...item,
        baseIndex,
        sequenceId: `${repeatIndex}-${item.id}-${baseIndex}`
      }))
    ).flat();
  }, [baseItems]);

  const loopWidth = Math.max(baseItems.length * STEP, STEP);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!trackRef.current) return;
    trackRef.current.style.transform = `translate3d(${xRef.current}px,0,0)`;
  }, [repeatedItems.length]);

  useEffect(() => {
    if (baseItems.length === 0 || repeatedItems.length === 0) return;

    if (prefersReducedMotion) {
      const viewportWidth = viewportRef.current?.clientWidth ?? 0;
      const centerIndex = Math.floor(baseItems.length / 2);
      const targetSequenceIndex = baseItems.length + centerIndex;
      const centeredX = viewportWidth / 2 - (targetSequenceIndex * STEP + STEP / 2);
      xRef.current = centeredX;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${xRef.current}px,0,0)`;
      }
      return;
    }

    const normalizeX = () => {
      if (baseItems.length <= 1) return;
      while (xRef.current <= -loopWidth * 2) {
        xRef.current += loopWidth;
      }
      while (xRef.current > -loopWidth) {
        xRef.current -= loopWidth;
      }
    };

    const chooseLanding = (now: number) => {
      const viewportWidth = viewportRef.current?.clientWidth ?? 0;
      if (viewportWidth <= 0 || baseItems.length === 0) return;

      let nextIndex = currentFeaturedIndexRef.current;
      if (baseItems.length > 1) {
        nextIndex = Math.floor(Math.random() * baseItems.length);
        if (nextIndex === currentFeaturedIndexRef.current) {
          nextIndex = (nextIndex + 1) % baseItems.length;
        }
      }

      const minTravel = Math.max(viewportWidth * 0.62, STEP * 2.5);
      const centerX = viewportWidth / 2;
      let bestTargetX = Number.NEGATIVE_INFINITY;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let repeatIndex = 0; repeatIndex < REPEAT_COUNT; repeatIndex += 1) {
        const sequenceIndex = repeatIndex * baseItems.length + nextIndex;
        const itemCenter = sequenceIndex * STEP + STEP / 2;
        const candidateX = centerX - itemCenter;
        const travelDistance = xRef.current - candidateX;
        if (travelDistance < minTravel) continue;
        if (travelDistance < bestDistance) {
          bestDistance = travelDistance;
          bestTargetX = candidateX;
        }
      }

      if (!Number.isFinite(bestTargetX)) {
        const fallbackSequenceIndex = (REPEAT_COUNT - 2) * baseItems.length + nextIndex;
        const fallbackItemCenter = fallbackSequenceIndex * STEP + STEP / 2;
        bestTargetX = centerX - fallbackItemCenter;
      }

      if (bestTargetX > xRef.current) {
        bestTargetX -= loopWidth;
      }

      modeRef.current = 'landing';
      landingStartXRef.current = xRef.current;
      landingTargetXRef.current = bestTargetX;
      landingStartTimeRef.current = now;
      currentFeaturedIndexRef.current = nextIndex;
    };

    const tick = (time: number) => {
      if (!isVisible) {
        lastTimeRef.current = time;
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }

      const dt = (time - (lastTimeRef.current ?? time)) / 1000;
      lastTimeRef.current = time;

      if (modeRef.current === 'cruise') {
        xRef.current -= CRUISE_SPEED * dt;

        if (time - lastLandingAtRef.current >= LANDING_EVERY_MS) {
          lastLandingAtRef.current = time;
          chooseLanding(time);
        }
      } else if (modeRef.current === 'landing') {
        const progress = Math.min(1, (time - landingStartTimeRef.current) / LANDING_DURATION_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        xRef.current = landingStartXRef.current + (landingTargetXRef.current - landingStartXRef.current) * eased;

        if (progress >= 1) {
          xRef.current = landingTargetXRef.current;
          modeRef.current = 'paused';
          pauseUntilRef.current = time + LANDING_PAUSE_MS;
        }
      } else if (modeRef.current === 'paused' && time >= pauseUntilRef.current) {
        modeRef.current = 'cruise';
      }

      normalizeX();

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${xRef.current}px,0,0)`;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    modeRef.current = 'cruise';
    lastLandingAtRef.current = 0;
    lastTimeRef.current = null;
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [baseItems, repeatedItems, isVisible, prefersReducedMotion, loopWidth]);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleViewBoxes = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    scrollToSection('popular-boxes');
  };

  return (
    <section className="relative w-full overflow-hidden rounded-[30px] border border-white/5 bg-[#02060d] px-3 py-3 sm:px-4 sm:py-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
        <div
          className="absolute -inset-[30%] rotate-[-12deg] bg-repeat opacity-[0.04] blur-[2px] animate-hero-drift"
          style={{ backgroundImage: `url(${pullzPattern})`, backgroundSize: '260px 260px' }}
        />
      </div>

      <div className="relative z-10 space-y-3 sm:space-y-4">
        <div ref={viewportRef} className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#070a12]">
          <div className="absolute left-1/2 top-0 z-30 h-0 w-0 -translate-x-1/2 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#ff4c00] drop-shadow-[0_0_14px_rgba(255,76,0,0.8)] sm:border-l-[16px] sm:border-r-[16px] sm:border-t-[28px]" />

          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-[#ff4c00]/80 shadow-[0_0_16px_rgba(255,76,0,0.9)]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#070a12] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#070a12] to-transparent" />

          <div className="h-[260px] sm:h-[320px] md:h-[430px] py-1">
            {repeatedItems.length > 0 ? (
              <div
                ref={trackRef}
                className="flex h-full items-stretch gap-2 px-2 will-change-transform"
                style={{ width: `${repeatedItems.length * STEP}px` }}
              >
                {repeatedItems.map((item) => (
                  <div key={item.sequenceId} className="flex w-[376px] shrink-0 items-stretch">
                    <div className="relative flex w-full flex-col rounded-[20px] border border-white/10 bg-gradient-to-b from-[#2a2d35] to-[#3a3d45] p-3 sm:p-4">
                      <div className="flex-1 overflow-hidden rounded-xl bg-black/20">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-contain p-4 sm:p-6"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2 text-2xl font-black text-white/70 sm:text-5xl">
                        <span className="text-[#ff4c00]">♦</span>
                        <span>{item.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-400">
                Select a demo box in admin to preview the spinner.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleViewBoxes}
          className="w-full rounded-2xl bg-[#ff4c00] px-6 py-4 text-xl font-black uppercase tracking-wide text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a3d]/80 sm:py-5"
        >
          View Boxes
        </button>
      </div>

      <style>{`
        @keyframes hero-drift {
          0% { transform: translate(-4%, -4%) rotate(-12deg); }
          50% { transform: translate(4%, 4%) rotate(-12deg); }
          100% { transform: translate(-4%, -4%) rotate(-12deg); }
        }
        .animate-hero-drift {
          animation: hero-drift 36s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};
