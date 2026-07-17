import React from 'react';
import { MysteryBox } from '../../types';
import { CoinAmount } from '../CoinAmount';
import { PullzBadge } from '../ui/PullzBadge';
import { PullzButton } from '../ui/PullzButton';
import { PullzSectionHeader } from '../ui/PullzSectionHeader';

export type FeaturedCasesProps = {
  boxes: MysteryBox[];
  trendingBoxIds: string[];
  onOpenBox: (boxId: string) => void;
  onViewAllBoxes: () => void;
};

export const FeaturedCases: React.FC<FeaturedCasesProps> = ({
  boxes,
  trendingBoxIds,
  onOpenBox,
  onViewAllBoxes
}) => {
  const selectedBoxes = trendingBoxIds
    .map((id) => boxes.find((box) => box.id === id))
    .filter(Boolean) as MysteryBox[];
  const featuredBoxes = (selectedBoxes.length ? selectedBoxes : boxes).slice(0, 6);

  return (
    <section
      id="mobile-trending-boxes"
      className="pullz-home-trending-grid scroll-mt-4 mt-7 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <div className="mx-auto max-w-[1180px]">
        <PullzSectionHeader
          eyebrow="Curated cases"
          title="Featured collections"
          description="Browse curated collectible cases with item pools visible before you open."
          action={
            <PullzButton variant="secondary" onClick={onViewAllBoxes}>
              See more
            </PullzButton>
          }
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(featuredBoxes.length ? featuredBoxes : (Array.from({ length: 6 }) as MysteryBox[])).map(
            (box, index) =>
              box ? (
                <button
                  key={box.id}
                  onClick={() => onOpenBox(box.id)}
                  className="group relative min-h-[184px] overflow-hidden rounded-pullz-lg border border-pullz-border-soft bg-pullz-card p-3 text-left shadow-pullz-sm transition duration-220 hover:-translate-y-1 hover:border-pullz-primary/35 hover:shadow-pullz-md active:scale-[0.98] sm:min-h-[198px] lg:min-h-[212px]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(36,107,253,0.12),transparent_42%)]" />
                  <img
                    src={box.image}
                    alt={`${box.name} case`}
                    width={160}
                    height={160}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="relative z-10 h-[112px] w-full object-contain transition duration-220 group-hover:scale-105 sm:h-[124px] lg:h-[132px]"
                  />
                  <PullzBadge variant="primary" className="absolute left-2 top-2 z-20">
                    Featured
                  </PullzBadge>
                  <div className="relative z-20 mt-3 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-pullz-text">{box.name}</span>
                    <CoinAmount
                      amount={Math.round(Number(box.price ?? 0))}
                      className="shrink-0 text-xs font-bold text-pullz-success sm:text-sm"
                      iconClassName="h-3.5 w-3.5"
                      animated={false}
                    />
                  </div>
                </button>
              ) : (
                <div
                  key={`trending-loading-${index}`}
                  className="min-h-[184px] animate-pulse rounded-pullz-lg bg-pullz-card sm:min-h-[198px] lg:min-h-[212px]"
                  aria-hidden="true"
                />
              )
          )}
        </div>
      </div>
    </section>
  );
};
