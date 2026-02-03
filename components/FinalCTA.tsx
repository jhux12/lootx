import React from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

export const FinalCTA: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useGame();
  const { playSound } = useSound();

  const handleGetStarted = () => {
    playSound('click');
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const element = document.getElementById('popular-boxes');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-purple-500/20 via-[#10182c] to-cyan-500/20 p-8 sm:p-10">
        <div className="flex flex-col gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/70">Start opening</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Ready to open your first case?</h2>
          </div>
          <button
            onClick={handleGetStarted}
            className="rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Get Started
          </button>
        </div>
      </div>
    </section>
  );
};
