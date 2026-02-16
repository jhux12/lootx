import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Trophy, Zap } from 'lucide-react';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';
import { CaseItem, MysteryBox } from '../types';

type HeroProps = {
  demoBox?: MysteryBox;
};

const BUFFER_COUNT = 14;
const ITEM_WIDTH = 116;
const AUTO_SPIN_INTERVAL_MS = 3600;
const SPIN_DURATION_MS = 1900;

const createFallbackItem = (box: MysteryBox): CaseItem => ({
  id: `${box.id}-demo`,
  name: box.name,
  price: box.price,
  image: box.image,
  rarity: 'rare',
  chance: 100,
  color: box.accentColor || '#22d3ee'
});

const buildReel = (winner: CaseItem, pool: CaseItem[]) => {
  const validPool = pool.length > 0 ? pool : [winner];
  const before = Array.from({ length: BUFFER_COUNT }, () => validPool[Math.floor(Math.random() * validPool.length)]);
  const after = Array.from({ length: BUFFER_COUNT }, () => validPool[Math.floor(Math.random() * validPool.length)]);
  return [...before, winner, ...after];
};

export const Hero: React.FC<HeroProps> = ({ demoBox }) => {
  const { isAuthenticated, openAuthModal } = useGame();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);

  const boxItems = useMemo(() => {
    if (!demoBox) return [];
    if (demoBox.items.length === 0) return [createFallbackItem(demoBox)];
    return demoBox.items;
  }, [demoBox]);

  const demoThumbnails = useMemo(() => boxItems.slice(0, 5), [boxItems]);

  const runSpin = () => {
    if (!demoBox || boxItems.length === 0 || isSpinning) return;
    const winner = boxItems[Math.floor(Math.random() * boxItems.length)];
    setIsSpinning(true);
    setReelItems(buildReel(winner, boxItems));

    window.setTimeout(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.style.transition = 'none';
      scrollContainerRef.current.style.transform = 'translateX(0px)';

      window.setTimeout(() => {
        if (!scrollContainerRef.current) return;
        const winnerLeft = BUFFER_COUNT * ITEM_WIDTH;
        const jitter = Math.floor(Math.random() * 90) - 45;
        const finalTranslate = -winnerLeft + jitter;
        scrollContainerRef.current.style.transition = `transform ${SPIN_DURATION_MS / 1000}s cubic-bezier(0.15, 0.85, 0.35, 1)`;
        scrollContainerRef.current.style.transform = `translateX(${finalTranslate}px)`;
      }, 36);
    }, 0);

    window.setTimeout(() => {
      setIsSpinning(false);
    }, SPIN_DURATION_MS + 200);
  };

  useEffect(() => {
    if (!demoBox || boxItems.length === 0) {
      setReelItems([]);
      return;
    }

    runSpin();

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      runSpin();
    }, AUTO_SPIN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoBox?.id, boxItems.length]);

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
                  {isSpinning ? 'Spinning' : 'Auto spinning'}
                </div>
              </div>

              <div className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#050811]">
                <div className="relative h-[138px]">
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#050811] to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#050811] to-transparent" />

                  {reelItems.length > 0 ? (
                    <div
                      ref={scrollContainerRef}
                      className="flex h-full items-stretch py-3"
                      style={{ width: `${reelItems.length * ITEM_WIDTH}px` }}
                    >
                      {reelItems.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="flex w-[116px] shrink-0 items-center justify-center px-1.5">
                          <div className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                            <img src={item.image} alt={item.name} className="mx-auto h-14 w-14 object-contain" loading="lazy" />
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

              <div className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-white/5 p-2">
                {demoBox?.image ? (
                  <img src={demoBox.image} alt={demoBox.name} className="h-24 w-full rounded-md object-cover sm:h-28" loading="eager" />
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-gray-400 sm:h-28">No box selected.</div>
                )}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {demoThumbnails.length > 0 ? (
                  demoThumbnails.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-1">
                      <img src={item.image} alt={item.name} className="h-10 w-full rounded object-cover sm:h-12" loading="lazy" />
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
