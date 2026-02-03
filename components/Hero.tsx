import React from 'react';
import heroImage from '../assets/hero.gif';
import { useGame } from '../context/GameContext';

export const Hero: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
    } else {
      scrollToSection('popular-boxes');
    }
  };

  return (
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f19] px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-[380px] max-h-[700px] w-full max-w-6xl flex-col items-center gap-10 sm:min-h-[420px] lg:h-[60vh] lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-xl text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Premium Cases</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Online Mystery Boxes
          </h1>
          <p className="mt-4 text-base text-gray-300 sm:text-lg">
            Open premium cases with real rewards. Keep what you win or sell it back instantly.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button
              type="button"
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:brightness-110"
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
            >
              How It Works
            </button>
          </div>
          <div className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-gray-400">
            Provably fair • Secure payments • Real inventory
          </div>
        </div>
        <div className="relative flex w-full max-w-xl items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 blur-2xl" />
          <img
            src={heroImage}
            className="relative z-10 h-[260px] w-full max-w-[420px] rounded-2xl object-contain sm:h-[320px] lg:h-[420px]"
            alt="Animated preview of mystery boxes"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
};
