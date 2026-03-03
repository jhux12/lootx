import React, { useMemo, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { toast } from '../toast/toast';
import { downloadWinStory, openXIntent, shareWin } from './shareWin';
import { WinSharePayload } from './types';

type WinShareButtonsProps = {
  payload: WinSharePayload;
};

export const WinShareButtons: React.FC<WinShareButtonsProps> = ({ payload }) => {
  const [isBusy, setIsBusy] = useState(false);

  const xText = useMemo(
    () => `I just unboxed ${payload.itemName} (${payload.itemValueText}) on Pullz.gg 🎉`,
    [payload.itemName, payload.itemValueText]
  );

  const onShare = async () => {
    setIsBusy(true);
    const result = await shareWin(payload);
    if (result.ok) {
      toast.success('Share ready');
    } else {
      toast.error('Couldn\'t generate share image, downloaded fallback instead');
    }
    setIsBusy(false);
  };

  const onDownload = async () => {
    setIsBusy(true);
    try {
      await downloadWinStory(payload);
      toast.success('Share ready');
    } catch {
      toast.error('Couldn\'t generate share image, downloaded fallback instead');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90">Share your win</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onShare}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-100 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
        <button
          type="button"
          onClick={() => openXIntent(xText)}
          disabled={isBusy}
          className="inline-flex items-center justify-center rounded-lg border border-indigo-300/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-100 disabled:opacity-50"
        >
          Share to X
        </button>
      </div>
    </div>
  );
};
