import React, { useEffect, useMemo, useRef, useState } from 'react';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';

type HeroProps = {
  demoBox?: MysteryBox;
};

type DemoReelItem = {
  id: string;
  name: string;
  image: string;
  price: number;
  color: string;
};

const CARD_WIDTH = 286;
const CARD_GAP = 10;
const STEP = CARD_WIDTH + CARD_GAP;
const REPEAT_COUNT = 6;
const CRUISE_SPEED = 118; // px/sec
const LANDING_EVERY_MS = 3200;
const LANDING_DURATION_MS = 950;
const LANDING_PAUSE_MS = 820;

const rarityColorMap: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b'
};

const normalizeDemoItems = (box?: MysteryBox): DemoReelItem[] => {
  if (!box) return [];

  const mapped = (box.items ?? [])
    .slice(0, 12)
    .map((item, index) => ({
      id: item.id || `${box.id}-item-${index}`,
      name: item.name || `Item ${index + 1}`,
      image: item.image || box.image || '',
      price: Number.isFinite(item.price) ? item.price : Math.max(99, Math.round(box.price || 999)),
      color: item.color || rarityColorMap[(item.rarity || '').toLowerCase()] || '#22d3ee'
    }))
    .filter((item) => item.image || item.name);

  if (mapped.length > 0) return mapped;

  return [
    {
      id: `${box.id}-fallback`,
      name: box.name || 'Featured Item',
      image: box.image || '',
      price: Math.max(99, Math.round(box.price || 999)),
      color: box.accentColor || '#22d3ee'
    }
  ];
};

export const Hero: React.FC<HeroProps> = ({ demoBox }) => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [landedSequenceIndex, setLandedSequenceIndex] = useState<number | null>(null);

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
      const centeredX = viewportWidth / 2 - (targetSequenceIndex * STEP + CARD_WIDTH / 2);
      xRef.current = centeredX;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${xRef.current}px,0,0)`;
      }
      setLandedSequenceIndex(targetSequenceIndex);
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
      let chosenSequenceIndex = -1;

      for (let repeatIndex = 0; repeatIndex < REPEAT_COUNT; repeatIndex += 1) {
        const sequenceIndex = repeatIndex * baseItems.length + nextIndex;
        const itemCenter = sequenceIndex * STEP + CARD_WIDTH / 2;
        const candidateX = centerX - itemCenter;
        const travelDistance = xRef.current - candidateX;
        if (travelDistance < minTravel) continue;
        if (travelDistance < bestDistance) {
          bestDistance = travelDistance;
          bestTargetX = candidateX;
          chosenSequenceIndex = sequenceIndex;
        }
      }

      if (!Number.isFinite(bestTargetX)) {
        const fallbackSequenceIndex = (REPEAT_COUNT - 2) * baseItems.length + nextIndex;
        const fallbackItemCenter = fallbackSequenceIndex * STEP + CARD_WIDTH / 2;
        bestTargetX = centerX - fallbackItemCenter;
        chosenSequenceIndex = fallbackSequenceIndex;
      }

      if (bestTargetX > xRef.current) {
        bestTargetX -= loopWidth;
      }

      modeRef.current = 'landing';
      landingStartXRef.current = xRef.current;
      landingTargetXRef.current = bestTargetX;
      landingStartTimeRef.current = now;
      currentFeaturedIndexRef.current = nextIndex;
      setLandedSequenceIndex(chosenSequenceIndex);
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

      if (modeRef.current === 'cruise') {
        normalizeX();
      }

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

          {demoBox?.image && (
            <div className="pointer-events-none absolute right-3 top-3 z-30 overflow-hidden rounded-lg border border-white/20 bg-black/40 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] backdrop-blur">
              <img src={demoBox.image} alt={demoBox.name || 'Demo box'} className="h-14 w-14 object-cover sm:h-16 sm:w-16" loading="lazy" />
            </div>
          )}

          <div className="h-[240px] sm:h-[290px] md:h-[340px] py-1">
            {repeatedItems.length > 0 ? (
              <div
                ref={trackRef}
                className="flex h-full items-stretch will-change-transform"
                style={{ width: `${repeatedItems.length * STEP}px`, columnGap: `${CARD_GAP}px` }}
              >
                {repeatedItems.map((item, idx) => {
                  const isLanded = landedSequenceIndex === idx;
                  return (
                  <div key={item.sequenceId} className="flex w-[286px] shrink-0 items-stretch">
                    <div
                      className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border p-3 transition ${isLanded ? 'scale-[1.01] border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]' : 'border-gray-800'} bg-[#151a23]`}
                      style={{ boxShadow: isLanded ? `0 0 22px ${item.color}66` : `0 4px 0 0 ${item.color}20` }}
                    >
                      <div
                        className="absolute inset-4 rounded-full opacity-90"
                        style={{
                          background: `radial-gradient(circle, ${item.color}75 0%, ${item.color}2d 45%, ${item.color}00 78%)`
                        }}
                      ></div>
                      <img
                        src={item.image}
                        alt={item.name}
                        className="relative z-10 mb-1 h-32 w-32 object-contain sm:h-36 sm:w-36"
                        loading="lazy"
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-xl opacity-80"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <div className="relative z-10 mt-1 flex items-center justify-center rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-sm font-bold text-white sm:text-base">
                        <CoinAmount amount={Math.round(item.price)} iconClassName="h-4 w-4" textClassName="text-white font-bold" />
                      </div>
                    </div>
                  </div>
                );})}
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
          className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-4 text-xl font-black uppercase tracking-wide text-white shadow-[0_14px_34px_-18px_rgba(124,58,237,0.85)] transition hover:shadow-[0_0_24px_rgba(34,211,238,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:py-5"
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
