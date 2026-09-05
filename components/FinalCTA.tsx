import React from 'react';
import { useGame } from '../context/GameContext';
import { setPostSignupRedirect } from '../utils/postSignupRedirect';
import { trackEvent } from '../utils/trackEvent';

export const FinalCTA: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      trackEvent('signup_cta_clicked', { placement: 'final_cta' });
      setPostSignupRedirect('/case/free-box');
      openAuthModal('register');
      return;
    }
    const target = document.getElementById('popular-boxes');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#205DD7]/15 via-[#101724] to-sky-500/15 p-8 text-center sm:p-10">
        <h2 className="text-2xl font-semibold text-white">Ready to open your first pack?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Join thousands of players opening premium drops every day.
        </p>
        <button
          onClick={handleGetStarted}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#205DD7] to-sky-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(32,93,215,0.8)] transition hover:translate-y-[-1px]"
        >
          Get Started
        </button>
      </div>
    </section>
  );
};
