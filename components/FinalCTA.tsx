import React from 'react';
import { useGame } from '../context/GameContext';

export const FinalCTA: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    const target = document.getElementById('popular-boxes');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-purple-500/15 via-[#101724] to-cyan-500/15 p-8 text-center sm:p-10">
        <h2 className="text-2xl font-semibold text-white">Ready to open your first box?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Join thousands of players opening premium drops every day.
        </p>
        <button
          onClick={handleGetStarted}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(124,58,237,0.8)] transition hover:translate-y-[-1px]"
        >
          Get Started
        </button>
      </div>
    </section>
  );
};
