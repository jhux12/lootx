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
    <section className="relative h-[60vh] min-h-[420px] max-h-[700px] w-full overflow-visible rounded-3xl border border-white/5 px-6 py-12 sm:px-10 lg:h-[62vh] lg:px-14 lg:py-16">
      <style>{`
        @keyframes hero-drift {
          0% { background-position: 0 0; }
          100% { background-position: 480px 480px; }
        }

        @keyframes hero-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .hero-pattern {
          background-size: 320px 320px;
          background-repeat: repeat;
          opacity: 0.065;
          filter: blur(2px);
          transform: rotate(-8deg) scale(1.15);
          animation: hero-drift 120s linear infinite;
        }

        .hero-image-float {
          animation: hero-float 12s ease-in-out infinite;
        }
      `}</style>
      <div className="absolute inset-0 rounded-3xl border border-white/5 bg-gradient-to-br from-[#0b0f1a] via-[#0d1322] to-[#12192e] shadow-[0_30px_80px_rgba(7,12,24,0.7)]" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div
          className="hero-pattern absolute -inset-16"
          style={{ backgroundImage: `url(${pullzPattern})` }}
        />
        <div className="absolute -top-24 left-6 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-28 right-8 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>
      <div className="relative mx-auto grid min-h-[420px] max-h-[700px] items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:h-[62vh]">
        <div className="space-y-6 text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/70">
            Mystery Box Website
          </p>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Unbox Premium Items &amp; Win Big
            </h1>
            <p className="max-w-xl text-sm text-gray-300 sm:text-base">
              Open premium mystery boxes featuring sneakers, gaming gear, collectibles, and more. Keep
              what you win or sell it back instantly.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-16px_rgba(124,58,237,0.9)] transition hover:shadow-[0_0_28px_rgba(56,189,248,0.7)]"
            >
              Get Started
            </button>
          </div>
        </div>
        <div className="relative flex h-[40vh] min-h-[260px] max-h-[520px] items-center justify-center lg:h-[58vh] lg:min-h-[420px] lg:max-h-[700px]">
          <div className="hero-image-float relative h-full w-full">
            <div className="absolute inset-0 translate-x-0 lg:translate-x-6 lg:-translate-y-2">
              <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e14] shadow-[0_24px_60px_rgba(8,12,24,0.8)]">
                <img
                  src={heroImage}
                  className="h-full w-full object-contain"
                  alt="Pullz.gg hero preview"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
