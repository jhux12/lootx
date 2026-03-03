import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { ProvablyFairModal } from './ProvablyFairModal';

type Props = {
  data: {
    serverSeedHash?: string;
    clientSeed?: string;
    nonce?: number;
  };
};

export const ProvablyFairBadge: React.FC<Props> = ({ data }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="All results verifiable"
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200"
      >
        <Shield className="h-3.5 w-3.5" /> Provably Fair
      </button>
      <ProvablyFairModal isOpen={open} onClose={() => setOpen(false)} data={data} />
    </>
  );
};
