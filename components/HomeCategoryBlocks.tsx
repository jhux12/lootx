import React, { useMemo } from 'react';
import type { MysteryBox } from '../types';
import { getBoxTags } from '../utils/boxTags';

type HomeCategoryBlocksProps = {
  boxes: MysteryBox[];
  onSelectCategory: (slug: string) => void;
};

const toTitle = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join(' ');

export const HomeCategoryBlocks: React.FC<HomeCategoryBlocksProps> = ({ boxes, onSelectCategory }) => {
  const categories = useMemo(() => {
    const tags = new Set<string>();
    boxes.forEach((box) => {
      if (box.isDaily || box.isUserCreated) return;
      getBoxTags(box).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b)).slice(0, 10);
  }, [boxes]);

  if (!categories.length) return null;

  return (
    <section className="space-y-5">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-black text-white sm:text-4xl">Mystery Boxes by Category</h2>
        <p className="mx-auto max-w-3xl text-sm text-gray-300 sm:text-base">
          Browse categories tailored to every vibe. Open boxes, keep what you love, and instantly sell back anything you don&apos;t want.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2.5">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
            className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-100 transition hover:border-violet-300/50 hover:text-white"
          >
            {toTitle(category)}
          </button>
        ))}
      </div>
    </section>
  );
};
