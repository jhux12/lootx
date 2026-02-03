import React from 'react';
import heroImage from '../assets/hero.gif';
import { useGame } from '../context/GameContext';

export const Hero: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
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
    <section className="relative w-full overflow-hidden rounded-[28px] border border-white/5 bg-[#0b0f17] px-6 py-10 md:px-10 lg:px-14">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-purple-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[140px]" />
      <div className="relative mx-auto flex min-h-[360px] max-h-[700px] w-full max-w-6xl flex-col items-center gap-10 md:h-[60vh] md:min-h-[420px] md:flex-row md:gap-12 lg:h-[65vh] lg:min-h-[460px] lg:gap-16">
        <div className="flex w-full flex-1 flex-col items-start text-left">
          <span className="mb-4 inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-200">
            Premium drops
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Online Mystery Boxes
          </h1>
          <p className="mt-4 max-w-xl text-sm text-gray-300 sm:text-base lg:text-lg">
            Open premium cases with real rewards. Keep what you win or sell it back instantly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleGetStarted}
              className="rounded-full bg-gradient-to-r from-brand-purple to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(124,58,237,0.9)] transition-transform hover:-translate-y-0.5"
            >
              Get Started
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white"
            >
              How It Works
            </button>
          </div>
          <p className="mt-5 text-xs font-medium text-gray-400">
            Provably fair • Secure payments • Real inventory
          </p>
        </div>
        <div className="flex w-full flex-1 items-center justify-center">
          <div className="relative flex h-full min-h-[220px] w-full items-center justify-center rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 via-transparent to-transparent p-6">
            <img
              src={heroImage}
              className="h-full max-h-[420px] w-full object-contain"
              alt="Pullz.gg hero animation"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
