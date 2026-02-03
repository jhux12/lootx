import React from 'react';
import heroImage from '../assets/hero.gif';
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
    <section className="relative w-full overflow-hidden rounded-3xl border border-white/5 bg-[#0c1019] px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
      <div className="pointer-events-none absolute -top-24 left-8 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
            Premium cases
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Online Mystery Boxes
            </h1>
            <p className="max-w-xl text-sm text-gray-300 sm:text-base">
              Open premium cases with real rewards. Keep what you win or sell it back instantly.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(124,58,237,0.8)] transition hover:translate-y-[-1px]"
            >
              Get Started
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
            >
              How It Works
            </button>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
            Provably fair • Secure payments • Real inventory
          </p>
        </div>
        <div className="flex h-[52vh] min-h-[320px] max-h-[520px] items-center justify-center lg:h-[62vh] lg:min-h-[420px] lg:max-h-[700px]">
          <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/5 bg-[#0b0e14]">
            <img
              src={heroImage}
              className="h-full w-full object-contain"
              alt="LootX hero animation"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
