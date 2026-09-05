import React from 'react';
import { useGame } from '../context/GameContext';
import caselabImage from '../assets/caselab.jpg';

export const CaseLabPromo: React.FC = () => {
  const { setView } = useGame();

  return (
    <section>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#0f1522] via-[#111827] to-[#101724]">
        <div className="flex flex-col items-center gap-6 px-6 py-8 sm:px-10 md:flex-row md:justify-between md:py-10 min-h-[180px] md:min-h-[200px]">
          <div className="space-y-3 text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">Introducing</p>
            <div>
              <h2 className="text-2xl font-semibold text-white">Pack Lab</h2>
              <p className="mt-2 text-sm text-gray-300">Craft your own custom packs</p>
            </div>
            <button
              onClick={() => setView({ type: 'CUSTOM_CREATOR' })}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#205DD7] to-sky-400 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(32,93,215,0.8)] transition hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            >
              Start Experimenting
            </button>
          </div>
          <div className="w-full max-w-[260px] md:max-w-[320px]">
            <img
              src={caselabImage}
              alt="Pack Lab preview"
              className="h-[140px] w-full object-contain md:h-[160px]"
              loading="lazy"
              decoding="async"
              width={640}
              height={320}
              style={{ aspectRatio: "2 / 1" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
