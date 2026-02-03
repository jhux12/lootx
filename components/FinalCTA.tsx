import React from 'react';
import { useGame } from '../context/GameContext';

export const FinalCTA: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const target = document.getElementById('popular-boxes');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="mt-16">
      <div className="rounded-[28px] border border-white/10 bg-gradient-to-r from-purple-500/20 via-[#0b0f18] to-cyan-500/20 px-6 py-10 text-center md:px-10">
        <h2 className="text-2xl font-semibold text-white">Ready to open your first case?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Start with a premium box and claim your real rewards.
        </p>
        <button
          onClick={handleGetStarted}
          className="mt-6 rounded-full bg-gradient-to-r from-brand-purple to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(34,211,238,0.9)] transition-transform hover:-translate-y-0.5"
        >
          Get Started
        </button>
      </div>
    </section>
  );
};
