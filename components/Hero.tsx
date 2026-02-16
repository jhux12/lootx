import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Trophy, Zap } from 'lucide-react';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';
import { CaseItem, MysteryBox } from '../types';

type HeroProps = {
  demoBox?: MysteryBox;
};

type DemoReelItem = {
  id: string;
  name: string;
  image: string;
};

const CARD_WIDTH = 112;
const CARD_GAP = 10;
const STEP = CARD_WIDTH + CARD_GAP;
const REPEAT_COUNT = 6;
const CRUISE_SPEED = 120; // px/sec
const LANDING_EVERY_MS = 3400;
const LANDING_DURATION_MS = 1100;
const LANDING_PAUSE_MS = 900;

const createFallbackItem = (box: MysteryBox): DemoReelItem => ({
  id: `${box.id}-demo`,
  name: box.name || 'Featured Drop',
  image: box.image || ''
});

const normalizeDemoItems = (box?: MysteryBox): DemoReelItem[] => {
  if (!box) return [];
  const mapped = (box.items ?? [])
    .slice(0, 12)
    .map((item, index) => ({
      id: item.id || `${box.id}-item-${index}`,
      name: item.name || `Drop ${index + 1}`,
      image: item.image || box.image || ''
    }))
    .filter((item) => item.name.trim().length > 0);

  if (mapped.length === 0) {
    return [createFallbackItem(box)];
  }

  return mapped;
};

export const Hero: React.FC<HeroProps> = ({ demoBox }) => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [featuredItem, setFeaturedItem] = useState<DemoReelItem | null>(null);

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
    const handleVisibility = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (baseItems.length === 0) {
      setFeaturedItem(null);
      return;
    }
    currentFeaturedIndexRef.current = 0;
    setFeaturedItem(baseItems[0]);
  }, [baseItems]);

  useEffect(() => {
    if (!trackRef.current) return;
    trackRef.current.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
  }, [repeatedItems.length]);

  useEffect(() => {
    if (baseItems.length === 0 || repeatedItems.length === 0) {
      return;
    }

    if (prefersReducedMotion) {
      const viewportWidth = viewportRef.current?.clientWidth ?? 0;
      const centerIndex = Math.floor(baseItems.length / 2);
      const targetSequenceIndex = baseItems.length + centerIndex;
      const centeredX = viewportWidth / 2 - (targetSequenceIndex * STEP + STEP / 2);
      xRef.current = centeredX;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
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

      const minTravel = Math.max(viewportWidth * 0.6, STEP * 3);
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
      setFeaturedItem(baseItems[nextIndex]);
    };

    const tick = (time: number) => {
      if (!isVisible || isHovered) {
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
        trackRef.current.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
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
  }, [baseItems, repeatedItems, isHovered, isVisible, prefersReducedMotion, loopWidth]);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    scrollToSection('popular-boxes');
  };

  return (
    <section className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0b101a] via-[#0d121e] to-[#0b1323] px-4 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
        <div
          className="absolute -inset-[35%] rotate-[-12deg] bg-repeat opacity-[0.06] blur-[2px] animate-hero-drift"
          style={{ backgroundImage: `url(${pullzPattern})`, backgroundSize: '280px 280px' }}
        />
        <div className="absolute -top-24 left-0 h-60 w-60 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Live box demo</p>
          <div className="space-y-3">
            <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
              Spin the box.
              <span className="block bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-300 bg-clip-text text-transparent">
                Watch the hype land.
              </span>
            </h1>
            <p className="max-w-xl text-sm text-gray-300 sm:text-base">
              Your selected demo box now spins with the same reel-style motion used on the unboxing experience.
              Smooth and fully mobile-friendly.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs text-gray-300 sm:grid-cols-3 sm:text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Zap className="mb-1 h-4 w-4 text-cyan-300" /> Auto spin every few seconds</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Sparkles className="mb-1 h-4 w-4 text-fuchsia-300" /> Admin-picked featured box</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Trophy className="mb-1 h-4 w-4 text-amber-300" /> Drop thumbnails preview</div>
          </div>

          <button
            onClick={handleGetStarted}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(124,58,237,0.8)] transition hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            Get Started
          </button>
        </div>

        <div className="mx-auto w-full max-w-[560px]">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02] p-3 shadow-[0_35px_70px_-45px_rgba(34,211,238,0.5)] sm:p-4">
            <div className="rounded-2xl border border-white/10 bg-[#090f19]/80 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/70">Demo box</p>
                  <h2 className="text-base font-bold text-white sm:text-lg">{demoBox?.name ?? 'Select a hero box in Admin'}</h2>
                </div>
                <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {prefersReducedMotion ? 'Reduced motion' : 'Auto spinning'}
                </div>
              </div>

              <div
                ref={viewportRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative mb-4 overflow-hidden rounded-xl border border-white/10 bg-[#050811]"
              >
                <div className="h-[142px] py-3">
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.95)]" />
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#050811] to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#050811] to-transparent" />

                  {repeatedItems.length > 0 ? (
                    <div
                      ref={trackRef}
                      className="flex h-full items-stretch gap-[10px] px-2 will-change-transform"
                      style={{ width: `${repeatedItems.length * STEP}px` }}
                    >
                      {repeatedItems.map((item) => (
                        <div
                          key={item.sequenceId}
                          className="group flex w-[112px] shrink-0 items-center justify-center"
                        >
                          <div className="w-full rounded-xl border border-white/10 bg-white/5 p-2 text-center transition md:group-hover:-translate-y-0.5 md:group-hover:border-white/20">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="mx-auto h-14 w-14 object-contain" loading="lazy" />
                            ) : (
                              <div className="mx-auto h-14 w-14 rounded-lg border border-white/10 bg-white/5" />
                            )}
                            <p className="mt-1 truncate text-[10px] font-semibold text-gray-200">{item.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-400">
                      Choose a demo box in admin to preview the spinner here.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/10 via-sky-400/5 to-fuchsia-400/10 p-3 shadow-[0_18px_30px_-22px_rgba(34,211,238,0.8)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Featured Item</p>
                <div className="mt-2 flex items-center gap-3">
                  {featuredItem?.image ? (
                    <img
                      src={featuredItem.image}
                      alt={featuredItem.name}
                      className="h-16 w-16 rounded-lg border border-white/10 bg-white/5 object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-white/10 bg-white/5" />
                  )}
                  <p className="max-w-[210px] truncate text-sm font-semibold text-white sm:max-w-[260px]">{featuredItem?.name ?? 'Waiting for next drop'}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {baseItems.length > 0 ? (
                  baseItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-1">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-10 w-full rounded object-cover sm:h-12" loading="lazy" />
                      ) : (
                        <div className="h-10 w-full rounded border border-white/10 bg-white/5 sm:h-12" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-gray-400">
                    Thumbnail preview will appear once your demo box is selected.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hero-drift {
          0% { transform: translate(-4%, -4%) rotate(-12deg); }
          50% { transform: translate(4%, 4%) rotate(-12deg); }
          100% { transform: translate(-4%, -4%) rotate(-12deg); }
        }
        .animate-hero-drift {
          animation: hero-drift 38s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};
