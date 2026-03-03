import React from 'react';
import heroImage from '../assets/hero.png';
import pullzPattern from '../assets/pullz-p.PNG';
import { useGame } from '../context/GameContext';

export const Hero: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();

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
    <section className="relative w-full overflow-hidden lg:overflow-visible rounded-[32px] border border-white/5 bg-gradient-to-br from-[#0b101a] via-[#0d121e] to-[#0b1323] px-6 py-8 sm:py-12 sm:px-10 lg:px-14 lg:py-16 h-[62vh] min-h-[520px] max-h-[760px] sm:h-[58vh] sm:min-h-[440px] sm:max-h-[640px]">
      <div className="pointer-events-none absolute inset-0 rounded-[32px] overflow-hidden">
        <div
          className="absolute -inset-[35%] opacity-[0.06] blur-[2px] rotate-[-12deg] bg-repeat animate-hero-drift"
          style={{ backgroundImage: `url(${pullzPattern})`, backgroundSize: '280px 280px' }}
        />
        <div className="absolute -top-28 left-6 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto grid h-full max-w-6xl items-start gap-10 lg:items-center lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">
            Mystery Box Website
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl lg:leading-tight">
              Unbox Premium Items &amp; Win Big
            </h1>
            <p className="max-w-xl text-sm text-gray-300 sm:text-base">
              Open premium mystery boxes featuring sneakers, gaming gear, collectibles, and more.
              Keep what you win or sell it back instantly.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(124,58,237,0.8)] transition hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            >
              Get Started
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-400">
            <span>Provably fair</span>
            <span className="text-gray-600">•</span>
            <span>Real inventory</span>
            <span className="text-gray-600">•</span>
            <span>Instant sellback</span>
          </div>
        </div>
        <div className="relative flex h-full items-center justify-center">
          <div className="relative w-full h-[40vh] max-h-[340px] sm:h-[38vh] sm:max-h-[400px] lg:h-[52vh] lg:max-h-[560px] lg:-mr-10 lg:translate-x-6">
            <img
              src={heroImage}
              className="relative z-10 h-full w-full object-contain object-top scale-110 sm:scale-100 -translate-y-4 sm:translate-y-0 animate-hero-float"
              alt="Pullz.gg hero"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              width={960}
              height={960}
              style={{ aspectRatio: '1 / 1' }}
            />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes hero-drift {
          0% { transform: translate(-4%, -4%) rotate(-12deg); }
          50% { transform: translate(4%, 4%) rotate(-12deg); }
          100% { transform: translate(-4%, -4%) rotate(-12deg); }
        }
        @keyframes hero-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-hero-drift {
          animation: hero-drift 38s ease-in-out infinite;
        }
        .animate-hero-float {
          animation: hero-float 12s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};
