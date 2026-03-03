import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from '../toast/toast';
import { shareWin } from './shareWin';
import { WinSharePayload } from './types';

type WinShareButtonsProps = {
  payload: WinSharePayload;
};

export const WinShareButtons: React.FC<WinShareButtonsProps> = ({ payload }) => {
  const [isBusy, setIsBusy] = useState(false);

  const onShare = async () => {
    setIsBusy(true);
    const result = await shareWin(payload);
    if (result.ok) {
      toast.success('Share ready');
    } else {
      toast.error('Couldn\'t generate share image');
    }
    setIsBusy(false);
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90">Share your win</p>
      <button
        type="button"
        onClick={onShare}
        disabled={isBusy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-50"
      >
        <Share2 className="h-4 w-4" />
        {isBusy ? 'Generating…' : 'Share'}
      </button>
    </div>
  );
};
