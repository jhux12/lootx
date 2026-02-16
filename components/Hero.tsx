import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Trophy, Zap } from 'lucide-react';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';
import { MysteryBox } from '../types';

type HeroProps = {
  demoBox?: MysteryBox;
};

const SPIN_INTERVAL_MS = 3400;

export const Hero: React.FC<HeroProps> = ({ demoBox }) => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [spinCount, setSpinCount] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSpinCount((count) => count + 1);
    }, SPIN_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const demoItems = useMemo(
    () => (demoBox?.items ?? []).slice(0, 5),
    [demoBox]
  );

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
              Your selected demo box now rotates automatically so every new visitor can feel the rush before opening.
              Built for smooth mobile and desktop motion.
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

        <div className="mx-auto w-full max-w-[520px]">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02] p-3 shadow-[0_35px_70px_-45px_rgba(34,211,238,0.5)] sm:p-4">
            <div className="rounded-2xl border border-white/10 bg-[#090f19]/80 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/70">Demo box</p>
                  <h2 className="text-base font-bold text-white sm:text-lg">{demoBox?.name ?? 'Select a hero box in Admin'}</h2>
                </div>
                <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Auto spinning
                </div>
              </div>

              <div className="relative mx-auto mb-4 flex h-[220px] w-full max-w-[340px] items-center justify-center sm:h-[260px]">
                <div className="absolute inset-4 rounded-full border border-dashed border-cyan-300/20" />
                <div className="absolute h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
                <div key={spinCount} className="relative h-[190px] w-[190px] animate-demo-spin sm:h-[220px] sm:w-[220px]">
                  <div className="absolute inset-0 rounded-[26px] border border-white/20 bg-gradient-to-br from-[#101a2d] via-[#0f1728] to-[#08111f] shadow-[0_24px_40px_-24px_rgba(0,0,0,0.85)]" />
                  {demoBox?.image ? (
                    <img
                      src={demoBox.image}
                      alt={demoBox.name}
                      className="absolute inset-[18%] h-[64%] w-[64%] object-contain"
                      loading="eager"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-gray-400">
                      Choose a demo box in admin to preview it here.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {demoItems.length > 0 ? (
                  demoItems.map((item) => (
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
        @keyframes demo-spin {
          0% { transform: rotateY(0deg) rotateX(0deg); }
          40% { transform: rotateY(170deg) rotateX(7deg); }
          100% { transform: rotateY(360deg) rotateX(0deg); }
        }
        .animate-hero-drift {
          animation: hero-drift 38s ease-in-out infinite;
        }
        .animate-demo-spin {
          transform-style: preserve-3d;
          animation: demo-spin 1.7s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </section>
  );
};
