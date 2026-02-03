import React from 'react';
import { useGame } from '../context/GameContext';

export const FinalCTA: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();

  const scrollToBoxes = () => {
    const element = document.getElementById('popular-boxes');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleClick = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
    } else {
      scrollToBoxes();
    }
  };

  return (
    <section className="mt-16 px-4 md:px-0">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-purple-500/20 via-[#0b0f18] to-cyan-500/20 p-8 text-center shadow-[0_30px_80px_-60px_rgba(99,102,241,0.6)] sm:p-10">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to open your first case?</h2>
        <p className="mt-3 text-sm text-gray-300 sm:text-base">
          Join thousands of players opening premium boxes every day.
        </p>
        <button
          type="button"
          onClick={handleClick}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:brightness-110"
        >
          Get Started
        </button>
      </div>
    </section>
  );
};
