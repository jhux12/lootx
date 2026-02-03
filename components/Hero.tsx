import React from 'react';
import heroImage from '../assets/hero.gif';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';

export const Hero: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    scrollToSection('popular-boxes');
  };

  return (
    <section className="relative w-full overflow-visible rounded-3xl border border-white/5 bg-gradient-to-br from-[#0b0f19] via-[#0b101b] to-[#101430] px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
      <style>{`
        @keyframes pullz-drift {
          0% {
            transform: translate3d(0px, 0px, 0) rotate(-8deg);
          }
          100% {
            transform: translate3d(-120px, -120px, 0) rotate(-8deg);
          }
        }

        .pullz-pattern {
          animation: pullz-drift 60s linear infinite;
          will-change: transform;
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-[0.06] blur-[2px] pullz-pattern"
        style={{
          backgroundImage: `url(${pullzPattern})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '240px 240px'
        }}
      />
      <div className="pointer-events-none absolute -top-24 left-8 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-purple-300/70">
            Mystery Box Website
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Unbox Premium Items &amp; Win Big
            </h1>
            <p className="max-w-xl text-sm text-gray-300 sm:text-base">
              Open premium mystery boxes featuring sneakers, gaming gear, collectibles, and more. Keep what you win or
              sell it back instantly.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-20px_rgba(124,58,237,0.9)] transition hover:shadow-[0_16px_40px_-14px_rgba(34,211,238,0.9)]"
            >
              Get Started
            </button>
          </div>
        </div>
        <div className="flex h-[60vh] min-h-[420px] max-h-[700px] items-center justify-center lg:h-[65vh]">
          <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/5 bg-[#0b0e14] shadow-[0_30px_80px_-40px_rgba(8,11,20,0.9)] lg:-mr-6 lg:translate-x-6">
            <img
              src={heroImage}
              className="h-full w-full object-contain"
              alt="Pullz.gg hero"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
