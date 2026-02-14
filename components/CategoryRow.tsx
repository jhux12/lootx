import React, { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { ShowcaseRowCategories } from '../utils/homepageShowcase';

type CategoryRowProps = {
  row: ShowcaseRowCategories;
};

export const CategoryRow: React.FC<CategoryRowProps> = ({ row }) => {
  const { setView } = useGame();
  const { playSound } = useSound();

  const categories = useMemo(
    () =>
      row.categories.filter(
        (category) => category.categorySlug.trim().length > 0 && category.imageUrl.trim().length > 0
      ),
    [row.categories]
  );

  if (categories.length === 0) return null;

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams();
    params.set('category', slug);
    playSound('click');
    setView({ type: 'BOXES' });
    window.history.replaceState({}, '', `/boxes?${params.toString()}`);
  };

  return (
    <section className="space-y-4">
      {row.title && <h3 className="text-2xl font-bold text-white">{row.title}</h3>}
      <div className="space-y-3">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => handleCategoryClick(category.categorySlug)}
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f1219] via-[#10141d] to-[#0a0d13] px-4 py-4 text-left transition hover:border-white/25"
          >
            <div className="relative z-10 flex flex-col gap-3">
              <h4 className="text-4xl font-bold leading-none text-white sm:text-3xl">{category.label || category.categorySlug}</h4>
              <span className="inline-flex w-fit items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-lg font-semibold text-white sm:text-base">
                View Boxes <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <img
              src={category.imageUrl}
              alt={category.label || category.categorySlug}
              loading="lazy"
              className="relative z-10 h-24 w-24 shrink-0 object-contain sm:h-28 sm:w-28"
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.06),transparent_60%)]" />
          </button>
        ))}
      </div>
    </section>
  );
};
