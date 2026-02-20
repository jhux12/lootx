import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { ShowcaseRowCategories } from '../utils/homepageShowcase';

const clampCount = (value: number | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < 1) return fallback;
  return rounded;
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(query);
    const handler = () => setMatches(media.matches);
    handler();
    if ('addEventListener' in media) {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [query]);

  return matches;
};

type CategoryRowProps = {
  row: ShowcaseRowCategories;
};

export const CategoryRow: React.FC<CategoryRowProps> = ({ row }) => {
  const { setView } = useGame();
  const { playSound } = useSound();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const visibleCount = clampCount(isMobile ? row.maxMobile : row.maxDesktop, isMobile ? 2 : 4);
  const gapSize = isMobile ? 12 : 16;

  const categories = useMemo(
    () =>
      row.categories.filter(
        (category) => category.categorySlug.trim().length > 0 && category.imageUrl.trim().length > 0
      ),
    [row.categories]
  );

  if (categories.length === 0) return null;

  const cardBasis = `calc((100% - ${gapSize * (visibleCount - 1)}px) / ${visibleCount})`;

  const handleViewAll = () => {
    playSound('click');
    window.history.replaceState({}, '', '/boxes');
    setView({ type: 'BOXES' });
  };

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams();
    params.set('category', slug);
    playSound('click');
    window.history.replaceState({}, '', `/boxes?${params.toString()}`);
    setView({ type: 'BOXES' });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{row.title}</h3>
          {row.subtitle && <p className="text-sm text-gray-400">{row.subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={handleViewAll}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 transition hover:text-white"
        >
          VIEW ALL <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-10 bg-gradient-to-r from-[#050811] via-[#050811]/80 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-10 bg-gradient-to-l from-[#050811] via-[#050811]/80 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#050811] via-[#050811]/90 to-transparent sm:hidden" />
        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory sm:gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryClick(category.categorySlug)}
              className="group relative min-h-[140px] snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e14] text-left shadow-[0_0_0_rgba(0,0,0,0)] transition hover:border-white/30 hover:shadow-[0_0_18px_rgba(56,189,248,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              style={{ flex: `0 0 ${cardBasis}` }}
            >
              <img
                src={category.imageUrl}
                alt={category.label || category.categorySlug}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-[#050811]/40 to-transparent" />
              <div className="relative z-10 flex h-full items-end p-4">
                <span className="text-sm font-semibold text-white drop-shadow">
                  {category.label || category.categorySlug}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
