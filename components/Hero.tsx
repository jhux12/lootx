import React from 'react';
import heroImage from '../assets/hero.gif';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

export const Hero: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();
  const { playSound } = useSound();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGetStarted = () => {
    playSound('click');
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    scrollToSection('popular-boxes');
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#0b0f1a] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="relative grid gap-10 lg:min-h-[420px] lg:max-h-[700px] lg:h-[62vh] lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/70">
              Pullz.gg Premium Cases
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
              Online Mystery Boxes
            </h1>
            <p className="mt-4 text-sm text-gray-300 sm:text-base">
              Open premium cases with real rewards. Keep what you win or sell it back instantly.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleGetStarted}
              className="rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(124,58,237,0.8)]"
            >
              Get Started
            </button>
            <button
              onClick={() => {
                playSound('click');
                scrollToSection('how-it-works');
              }}
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-gray-200 transition-colors hover:border-white/30 hover:text-white"
            >
              How It Works
            </button>
          </div>
          <p className="text-xs font-medium text-gray-400">
            Provably fair • Secure payments • Real inventory
          </p>
        </div>
        <div className="relative flex h-full min-h-[260px] items-center justify-center rounded-3xl border border-white/5 bg-[#0b111f]/80 p-6 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)] lg:min-h-[360px]">
          <img
            src={heroImage}
            className="h-full w-full object-contain"
            alt="Pullz.gg hero animation"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
};
