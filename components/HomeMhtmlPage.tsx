import React from 'react';

type HomeMhtmlPageProps = {
  onSignUp: () => void;
};

export const HomeMhtmlPage: React.FC<HomeMhtmlPageProps> = ({ onSignUp }) => {
  return (
    <section className="relative min-h-[calc(100vh-5rem)] w-full">
      <iframe
        title="Homepage preview"
        src="/home.mhtml"
        className="h-[calc(100vh-5rem)] w-full border-0"
        loading="eager"
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:bottom-6">
        <button
          type="button"
          onClick={onSignUp}
          className="pointer-events-auto w-full max-w-sm rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 sm:w-auto"
        >
          Claim Your Free Box
        </button>
      </div>
    </section>
  );
};
