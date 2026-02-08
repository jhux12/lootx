import React from 'react';
import { CoinAmount } from '../CoinAmount';
import { CaseItem } from '../../types';
import { Calculator, Flame, ShieldCheck } from 'lucide-react';

const formatPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

type BuildSummaryProps = {
  caseName: string;
  coverImage: string;
  selectedCount: number;
  selectedItems: CaseItem[];
  targetEv: number;
  riskLevel: number;
  sellBackPercent: number;
  publishFee: number;
  calculatedPrice: number;
  calculatedEv: number;
  lastCalculated: boolean;
  collapsible?: boolean;
};

export const BuildSummary: React.FC<BuildSummaryProps> = ({
  caseName,
  coverImage,
  selectedCount,
  selectedItems,
  targetEv,
  riskLevel,
  sellBackPercent,
  publishFee,
  calculatedPrice,
  calculatedEv,
  lastCalculated,
  collapsible
}) => {
  const summaryContent = (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {coverImage ? (
            <img src={coverImage} alt="Case cover preview" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">No cover</div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Build Summary</div>
          <div className="text-lg font-bold text-white">{caseName || 'Untitled Case'}</div>
          <div className="text-xs text-gray-400">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-[#0b0f16] p-4 text-sm text-gray-300">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-400">
            <ShieldCheck className="h-4 w-4" /> Target EV
          </span>
          <span className="font-semibold text-white">{formatPercent(targetEv)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-400">
            <Flame className="h-4 w-4" /> Risk Level
          </span>
          <span className="font-semibold text-white">{riskLevel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Sellback</span>
          <span className="font-semibold text-emerald-300">{sellBackPercent}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Publish fee</span>
          <CoinAmount
            amount={publishFee}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="text-emerald-200 font-semibold"
            iconClassName="h-4 w-4"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Calculated price
          </span>
          <CoinAmount
            amount={calculatedPrice}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="text-lg font-bold text-emerald-300"
            iconClassName="h-4 w-4"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>Expected value</span>
          <CoinAmount
            amount={calculatedEv}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="text-sm font-semibold text-white"
            iconClassName="h-3 w-3"
          />
        </div>
        {!lastCalculated && (
          <p className="mt-3 text-xs text-amber-300">
            Odds have not been synthesized yet. Calculated values will appear after Step 3.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4">
        <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Selected items</div>
        <div className="mt-3 space-y-2 text-sm text-gray-300">
          {selectedItems.length === 0 ? (
            <p className="text-xs text-gray-500">Select items to build your case.</p>
          ) : (
            selectedItems.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="truncate text-xs text-gray-400">{item.name}</span>
                <CoinAmount
                  amount={item.price}
                  formatOptions={{ maximumFractionDigits: 0 }}
                  className="text-xs text-emerald-200"
                  iconClassName="h-3 w-3"
                />
              </div>
            ))
          )}
          {selectedItems.length > 6 && (
            <p className="text-xs text-gray-500">+{selectedItems.length - 6} more items</p>
          )}
        </div>
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#121826] p-6 shadow-xl shadow-black/30">
        {summaryContent}
      </div>
    );
  }

  return (
    <details className="rounded-2xl border border-white/10 bg-[#121826] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-white">Build Summary</summary>
      <div className="mt-4">{summaryContent}</div>
    </details>
  );
};
