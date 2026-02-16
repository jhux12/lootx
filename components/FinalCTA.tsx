import React from 'react';
import { ArrowRight } from 'lucide-react';
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
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#30104f] via-[#141a2d] to-[#06344a] p-8 text-center sm:p-10">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to launch your first premium opening?</h2>
          <p className="mt-3 text-sm text-gray-200 sm:text-base">
            Sign in, pick a case, and experience a polished flow that works beautifully on both mobile and desktop.
          </p>
          <button
            onClick={handleGetStarted}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#111827] shadow-[0_14px_26px_-18px_rgba(255,255,255,0.9)] transition hover:translate-y-[-1px]"
          >
            Get started now
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
