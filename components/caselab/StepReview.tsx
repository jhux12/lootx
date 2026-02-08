import React from 'react';
import { CaseItem } from '../../types';
import { CoinAmount } from '../CoinAmount';
import { Beaker, CheckCircle2 } from 'lucide-react';

type StepReviewProps = {
  selectedItems: CaseItem[];
  selectedCount: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
  calculatedPrice: number;
  calculatedEv: number;
  lastCalculated: boolean;
  onSynthesize: () => void;
  onPublish: () => void;
  isSynthesizing: boolean;
  isPublishing: boolean;
};

export const StepReview: React.FC<StepReviewProps> = ({
  selectedItems,
  selectedCount,
  minValue,
  maxValue,
  avgValue,
  calculatedPrice,
  calculatedEv,
  lastCalculated,
  onSynthesize,
  onPublish,
  isSynthesizing,
  isPublishing
}) => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Step 3</div>
      <h2 className="mt-2 text-2xl font-bold text-white">Review & publish</h2>
      <p className="mt-1 text-sm text-gray-400">Synthesize the odds, verify the values, and publish when ready.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Selected items</div>
          <div className="mt-2 text-xl font-semibold text-white">{selectedCount}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Value range</div>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
            <CoinAmount
              amount={minValue}
              formatOptions={{ maximumFractionDigits: 0 }}
              className="text-emerald-200"
              iconClassName="h-3 w-3"
            />
            <span className="text-gray-500">to</span>
            <CoinAmount
              amount={maxValue}
              formatOptions={{ maximumFractionDigits: 0 }}
              className="text-emerald-200"
              iconClassName="h-3 w-3"
            />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Average value</div>
          <CoinAmount
            amount={avgValue}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="mt-2 text-lg font-semibold text-white"
            iconClassName="h-4 w-4"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Calculated price</div>
          <CoinAmount
            amount={calculatedPrice}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="mt-2 text-lg font-semibold text-emerald-300"
            iconClassName="h-4 w-4"
          />
          <div className="mt-1 text-xs text-gray-500">
            EV: {calculatedEv.toFixed(0)} coins
          </div>
        </div>
      </div>

      <div className="mt-6 hidden gap-3 lg:flex">
        {!lastCalculated ? (
          <button
            type="button"
            onClick={onSynthesize}
            disabled={isSynthesizing || selectedItems.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <Beaker className="h-4 w-4" />
            {isSynthesizing ? 'Synthesizing...' : 'Synthesize Odds'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isPublishing ? 'Publishing...' : 'Publish Case'}
          </button>
        )}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Item odds</div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#0b0f16] text-xs uppercase tracking-[0.2em] text-gray-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Odds</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item) => (
              <tr key={item.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={item.image} alt={item.name} className="h-8 w-8 object-contain" />
                    <span className="text-sm text-gray-200">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <CoinAmount
                    amount={item.price}
                    formatOptions={{ maximumFractionDigits: 0 }}
                    className="text-emerald-200"
                    iconClassName="h-3 w-3"
                  />
                </td>
                <td className="px-4 py-3 text-xs text-purple-200">
                  {lastCalculated ? `${item.chance.toFixed(3)}%` : 'Not calculated'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedItems.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">Select items to preview odds.</p>
      )}
    </div>
  </div>
);
