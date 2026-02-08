import React from 'react';
import { Beaker, ArrowRight, CheckCircle2 } from 'lucide-react';

const statusLabel = (lastCalculated: boolean) => (lastCalculated ? 'Calculated' : 'Not calculated');

type StickyActionBarProps = {
  step: number;
  selectedCount: number;
  lastCalculated: boolean;
  canProceed: boolean;
  isSynthesizing: boolean;
  isPublishing: boolean;
  onNext: () => void;
  onSynthesize: () => void;
  onPublish: () => void;
};

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  step,
  selectedCount,
  lastCalculated,
  canProceed,
  isSynthesizing,
  isPublishing,
  onNext,
  onSynthesize,
  onPublish
}) => {
  const isReviewStep = step === 3;
  const actionLabel = isReviewStep
    ? lastCalculated
      ? isPublishing
        ? 'Publishing...'
        : 'Publish'
      : isSynthesizing
        ? 'Synthesizing...'
        : 'Synthesize Odds'
    : 'Next';

  const actionIcon = isReviewStep
    ? lastCalculated
      ? CheckCircle2
      : Beaker
    : ArrowRight;

  const handleAction = () => {
    if (isReviewStep) {
      if (lastCalculated) {
        onPublish();
      } else {
        onSynthesize();
      }
      return;
    }
    onNext();
  };

  const Icon = actionIcon;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b0f16]/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="text-xs text-gray-400">
          <div className="text-sm font-semibold text-white">{selectedCount} selected</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gray-500">{statusLabel(lastCalculated)}</div>
        </div>
        <button
          type="button"
          onClick={handleAction}
          disabled={!canProceed || isSynthesizing || isPublishing}
          className="flex items-center gap-2 rounded-full bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:bg-purple-600 disabled:opacity-50"
        >
          <Icon className="h-4 w-4" />
          {actionLabel}
        </button>
      </div>
    </div>
  );
};
