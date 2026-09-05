import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface ProvablyFairMiniModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifySpin: () => void;
}

export const ProvablyFairMiniModal: React.FC<ProvablyFairMiniModalProps> = ({ isOpen, onClose, onVerifySpin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-2xl border border-gray-800 bg-[#0f1219] p-5 shadow-2xl shadow-black/60">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-gray-500 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-2 text-white">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <h3 className="text-lg font-bold">Provably Fair</h3>
        </div>

        <p className="text-sm leading-relaxed text-gray-300">
          Every pack opening is generated using a verifiable provably fair system. We commit to results before you spin, and you can independently verify outcomes.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-gray-300">
          <li>• Server seed is committed (hashed) before you spin</li>
          <li>• Your client seed + nonce influence the result</li>
          <li>• Verify any spin on the Provably Fair page</li>
        </ul>

        <button
          type="button"
          onClick={onVerifySpin}
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
        >
          Verify a Spin →
        </button>
      </div>
    </div>
  );
};
