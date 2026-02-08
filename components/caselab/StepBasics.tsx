import React from 'react';
import { Input } from '../ui/Input';
import { MysteryBox } from '../../types';

const fallbackCover = 'https://picsum.photos/300';

type StepBasicsProps = {
  caseName: string;
  onNameChange: (value: string) => void;
  coverImage: string;
  imageOptions: MysteryBox[];
  onCoverSelect: (image: string) => void;
};

export const StepBasics: React.FC<StepBasicsProps> = ({
  caseName,
  onNameChange,
  coverImage,
  imageOptions,
  onCoverSelect
}) => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Step 1</div>
      <h2 className="mt-2 text-2xl font-bold text-white">Name your case</h2>
      <p className="mt-1 text-sm text-gray-400">Pick a memorable title and choose a cover image.</p>
      <div className="mt-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Case name</label>
        <Input
          type="text"
          placeholder="My Luck Experiment"
          value={caseName}
          onChange={(event) => onNameChange(event.target.value)}
          className="px-4 py-3"
        />
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Cover image</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Choose your cover</h3>
        </div>
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <img
            src={coverImage || fallbackCover}
            alt="Cover preview"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {imageOptions.map((box) => (
          <button
            key={box.id}
            type="button"
            onClick={() => onCoverSelect(box.image)}
            className={`rounded-lg border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/70 ${
              coverImage === box.image
                ? 'border-brand-purple/70 bg-brand-purple/10'
                : 'border-white/10 bg-[#0b0f16] hover:border-white/30'
            }`}
            aria-label={`Use ${box.name} image`}
          >
            <img src={box.image} alt={box.name} className="h-12 w-full object-contain" />
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {coverImage ? 'Cover selected and ready for publish.' : 'Select a cover image to continue.'}
      </p>
    </div>
  </div>
);
