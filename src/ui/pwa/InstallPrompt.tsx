import React from 'react';
import { Download, Share2, X } from 'lucide-react';
import { useInstallPrompt } from '../../lib/pwa/useInstallPrompt';

export const InstallPrompt: React.FC = () => {
  const { isVisible, variant, canTriggerNativePrompt, promptInstall, dismiss } = useInstallPrompt();

  if (!isVisible || !variant) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[120] px-3 sm:bottom-6 sm:px-4">
      <div className="pointer-events-auto mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#070b17]/88 p-4 shadow-[0_16px_70px_rgba(40,12,92,0.65)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-cyan-400/10" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-cyan-300/40 bg-cyan-400/10 p-2 text-cyan-200">
              {variant === 'chromium' ? <Download className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {variant === 'chromium' ? 'Install Pullz for faster access' : 'Add Pullz to your Home Screen'}
              </p>
              {variant === 'chromium' ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Launch Pullz instantly, keep it full-screen, and enjoy a smoother mobile experience.
                </p>
              ) : (
                <div className="mt-1 text-xs leading-relaxed text-slate-300">
                  <p>1. Tap the <span className="font-medium text-cyan-200">Share</span> button in Safari.</p>
                  <p>2. Tap <span className="font-medium text-cyan-200">Add to Home Screen</span>.</p>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(true)}
            aria-label="Dismiss install prompt"
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {variant === 'chromium' && (
          <button
            type="button"
            onClick={promptInstall}
            disabled={!canTriggerNativePrompt}
            className="relative mt-4 flex w-full items-center justify-center rounded-xl border border-cyan-300/50 bg-gradient-to-r from-fuchsia-600/90 to-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Install Pullz
          </button>
        )}
      </div>
    </div>
  );
};
