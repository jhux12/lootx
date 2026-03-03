import React from 'react';

export const OfflineFallback: React.FC = () => {
  return (
    <div className="fixed inset-x-3 bottom-20 z-[140] mx-auto w-auto max-w-md rounded-2xl border border-cyan-400/30 bg-[#090c16]/95 p-4 shadow-[0_0_35px_rgba(34,211,238,0.2)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.24),_transparent_60%)]" aria-hidden="true" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-xs font-black tracking-wider text-cyan-200">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-cyan-200">Pullz.gg</p>
          <p className="mt-1 text-sm text-slate-200">You're offline. Cached content is still available.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};
