import React from 'react';
import { Wrench, Sparkles } from 'lucide-react';
import { BrandLockup } from './BrandLockup';

export const MaintenanceMode: React.FC = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-800 bg-gradient-to-br from-[#111827] via-[#0b0f1a] to-[#070a12] p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <BrandLockup className="justify-center" logoClassName="h-12" textClassName="text-xl" showTextOnMobile />
        </div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-purple/40 bg-brand-purple/10 text-brand-purple">
          <Wrench className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">We’re tuning the loot cannons</h1>
        <p className="mt-3 text-sm text-gray-400 sm:text-base">
          Maintenance mode is active while we add a few extra sparkles, recalibrate the drop gods, and feed the
          server hamsters.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <div className="flex items-center justify-center gap-2 rounded-full border border-gray-700 bg-[#0b0e14] px-4 py-2 text-xs font-semibold text-gray-300">
            <Sparkles className="h-4 w-4 text-blue-400" />
            We’ll be back shortly.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-brand-purple/50 bg-brand-purple/20 px-5 py-2 text-sm font-bold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            Try again
          </button>
        </div>
        <div className="mt-6 text-xs text-gray-500">
          Thanks for your patience. Your loot is safe, your luck is being polished.
        </div>
      </div>
    </main>
  );
};
