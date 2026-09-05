import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Input } from '../ui/Input';

const STEP_LABELS = ['1. Choose Your Pack', '2. Open & Reveal', '3. Keep It or Sell It Back'];

export const HomeHowItWorksEditor: React.FC = () => {
  const { stripeSettings, updateStripeSettings } = useGame();
  const [draft, setDraft] = useState<string[]>(stripeSettings.howItWorksStepImageUrls);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    setDraft(stripeSettings.howItWorksStepImageUrls);
  }, [stripeSettings.howItWorksStepImageUrls]);

  const updateStep = (index: number, value: string) => {
    setDraft((current) => {
      const next = [current[0] ?? '', current[1] ?? '', current[2] ?? ''];
      next[index] = value;
      return next;
    });
  };

  const handleSave = () => {
    updateStripeSettings({ ...stripeSettings, howItWorksStepImageUrls: draft.map((url) => url.trim()).slice(0, 3) });
    setNotice(true);
    window.setTimeout(() => setNotice(false), 3000);
  };

  return (
    <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">How It Works images</h3>
          <p className="mt-1 text-sm text-gray-400">
            Optional illustration for each of the 3 steps in the homepage's "How It Works" section. The step titles and copy are fixed; only the image is configurable. Leave a step blank to show it without an image.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="w-full shrink-0 rounded-lg bg-[#205DD7] px-3 py-2 text-xs font-bold text-white hover:bg-[#1f6bea] sm:w-auto"
        >
          Save images
        </button>
      </div>
      {notice && <p className="mt-3 text-xs text-green-400">How It Works images saved.</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="rounded-lg border border-white/10 bg-[#0b0e14] p-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">{label}</label>
            <Input
              type="text"
              value={draft[index] ?? ''}
              onChange={(event) => updateStep(index, event.target.value)}
              placeholder="https://.../step-image.png"
              className="w-full bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
            />
            {draft[index] ? (
              <div className="mt-2 flex h-20 items-center justify-center overflow-hidden rounded-md bg-[#161b22]">
                <img src={draft[index]} alt="" className="h-full w-auto object-contain" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
