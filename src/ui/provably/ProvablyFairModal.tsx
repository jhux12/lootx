import React from 'react';
import { X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  data: {
    serverSeedHash?: string;
    clientSeed?: string;
    nonce?: number;
    winningItem?: string;
    resultIndex?: number;
  };
};

export const ProvablyFairModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-[#0d1320] p-4 text-sm text-gray-200 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Provably Fair Verification</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 p-1.5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          <p>Server seed hash: <span className="text-cyan-200 break-all">{data.serverSeedHash ?? 'N/A'}</span></p>
          <p>Client seed: <span className="text-cyan-200 break-all">{data.clientSeed ?? 'N/A'}</span></p>
          <p>Nonce: <span className="text-cyan-200">{data.nonce ?? 'N/A'}</span></p>
          {data.winningItem ? <p>Winning item: <span className="text-cyan-200">{data.winningItem}</span></p> : null}
          {typeof data.resultIndex === 'number' ? <p>Result index: <span className="text-cyan-200">{data.resultIndex}</span></p> : null}
          <p className="text-xs text-gray-400">Formula: SHA256(serverSeed + ':' + clientSeed + ':' + nonce) → mapped to roll interval.</p>
        </div>
        <a href="/provably-fair#verify" className="mt-4 inline-flex text-xs text-cyan-300 underline">Open verification page</a>
      </div>
    </div>
  );
};
