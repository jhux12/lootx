import React from 'react';
import heroImage from '../assets/hero.gif';
import logoPattern from '../assets/pullz-p.PNG';
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
    <section className="relative w-full">
      <div className="relative min-h-[420px] max-h-[700px] rounded-3xl border border-white/5 bg-gradient-to-br from-[#0b0f1b] via-[#0c1220] to-[#0b1a2a] px-6 py-12 sm:px-10 lg:h-[62vh] lg:px-14 lg:py-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div
            className="hero-logo-drift absolute -inset-[40%] rotate-[-6deg] opacity-[0.06] blur-sm"
            style={{
              backgroundImage: `url(${logoPattern})`,
              backgroundRepeat: 'repeat',
              backgroundSize: '280px',
            }}
          />
        </div>
        <div className="pointer-events-none absolute -top-24 left-10 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/70">
              Mystery Box Website
            </p>
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
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_-20px_rgba(124,58,237,0.9)] transition hover:shadow-[0_20px_45px_-18px_rgba(34,211,238,0.75)]"
              >
                Get Started
              </button>
            </div>
          </div>
          <div className="flex h-[48vh] min-h-[280px] max-h-[520px] items-center justify-center lg:h-[60vh] lg:min-h-[420px] lg:max-h-[640px] lg:translate-x-6">
            <div className="relative h-full w-full rounded-3xl border border-white/10 bg-[#0b0e14]/80 p-4 shadow-[0_20px_60px_-30px_rgba(56,189,248,0.35)] backdrop-blur">
              <img
                src={heroImage}
                className="hero-float h-full w-full object-contain"
                alt="Pullz.gg hero"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
