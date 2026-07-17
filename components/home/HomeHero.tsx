import React from 'react';
import { Box, Sparkles } from 'lucide-react';
import { MysteryBox } from '../../types';
import { PullzBadge } from '../ui/PullzBadge';
import { PullzButton } from '../ui/PullzButton';
import { PullzSurface } from '../ui/PullzSurface';

type HomeHeroProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
  trendingBoxIds: string[];
  activeSlide: number;
  slideCount: number;
  onSlideSelect: (index: number) => void;
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
  onOpenBox: (boxId: string) => void;
  onExploreCases: () => void;
  onHowItWorks: () => void;
  onDepositOffer: () => void;
};

const fallbackCopy = {
  eyebrow: 'THE ONLINE COLLECTIBLES PLATFORM',
  headline: 'Pull Real Collectibles.',
  body:
    'Open curated collectible cases featuring real trading cards. Keep your pulls, ship them to your door, or sell them back for site credit.',
  primaryCta: 'Explore Cases',
  secondaryCta: 'How It Works',
  trustLine: 'Real inventory · Visible item pools · Fulfillment options'
};

export const HomeHero: React.FC<HomeHeroProps> = ({
  boxes,
  demoBoxId,
  trendingBoxIds,
  activeSlide,
  slideCount,
  onSlideSelect,
  onTouchStart,
  onTouchEnd,
  onOpenBox,
  onExploreCases,
  onHowItWorks,
  onDepositOffer
}) => {
  const demoBox = boxes.find((box) => box.id === demoBoxId) ?? boxes.find((box) => box.image);
  const trendingBoxes = trendingBoxIds
    .map((id) => boxes.find((box) => box.id === id))
    .filter(Boolean) as MysteryBox[];
  const heroBoxes = (trendingBoxes.length ? trendingBoxes : boxes).filter((box) => box.image).slice(0, 3);

  return (
    <section className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-4 lg:px-6">
      <div
        className="pullz-home-hero relative mx-auto min-h-[520px] w-full max-w-[1180px] overflow-hidden rounded-pullz-xl border border-pullz-border-soft bg-pullz-background text-left shadow-pullz-lg sm:min-h-[500px] lg:min-h-[540px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_16%,rgba(36,107,253,0.22),transparent_36%)]" />
        <div className="relative z-10 grid min-h-[520px] gap-6 p-5 sm:min-h-[500px] sm:p-7 lg:min-h-[540px] lg:grid-cols-[1fr_0.9fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <PullzBadge variant="primary">{fallbackCopy.eyebrow}</PullzBadge>
            <h1 className="mt-5 max-w-3xl text-[42px] font-bold leading-[0.98] tracking-tight text-pullz-text sm:text-6xl lg:text-7xl">
              {fallbackCopy.headline}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-pullz-text-secondary sm:text-lg">
              {fallbackCopy.body}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <PullzButton onClick={onExploreCases}>{fallbackCopy.primaryCta}</PullzButton>
              <PullzButton variant="secondary" onClick={onHowItWorks}>
                {fallbackCopy.secondaryCta}
              </PullzButton>
            </div>
            <p className="mt-5 text-sm font-medium text-pullz-text-muted">{fallbackCopy.trustLine}</p>
            <PullzSurface variant="base" className="mt-6 max-w-md p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-pullz-sm bg-pullz-gold-soft text-pullz-gold">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-pullz-text">First deposit bonus</p>
                  <p className="text-xs text-pullz-text-muted">Claim the active welcome offer when eligible.</p>
                </div>
                <PullzButton variant="ghost" className="px-3" onClick={onDepositOffer}>
                  View
                </PullzButton>
              </div>
            </PullzSurface>
          </div>

          <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-pullz-xl border border-pullz-border-soft bg-pullz-surface p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(36,107,253,0.18),transparent_44%)]" />
            <div className="relative grid grid-cols-3 items-center gap-2 sm:gap-3">
              {heroBoxes.length ? (
                heroBoxes.map((box, index) => (
                  <button
                    key={box.id}
                    type="button"
                    onClick={() => onOpenBox(box.id)}
                    className={`group flex min-h-[190px] items-center justify-center rounded-pullz-lg border border-pullz-border-soft bg-pullz-card p-2 transition duration-220 hover:-translate-y-1 hover:border-pullz-primary/35 hover:shadow-pullz-md sm:min-h-[240px] ${index === 1 ? 'sm:translate-y-7' : ''}`}
                    aria-label={`Open ${box.name}`}
                  >
                    <img
                      src={box.image}
                      alt={`${box.name} case`}
                      width={180}
                      height={180}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="max-h-44 w-full object-contain transition duration-220 group-hover:scale-105 sm:max-h-56"
                    />
                  </button>
                ))
              ) : (
                <div className="col-span-3 grid min-h-[260px] place-items-center rounded-pullz-lg border border-dashed border-pullz-border-strong text-center text-sm text-pullz-text-muted">
                  Curated cases appear here when box data is available.
                </div>
              )}
            </div>
            {demoBox ? (
              <button
                type="button"
                onClick={() => onOpenBox(demoBox.id)}
                className="relative mt-5 flex items-center gap-3 rounded-pullz-lg border border-pullz-border-soft bg-pullz-card/80 p-3 text-left transition duration-220 hover:border-pullz-primary/35"
              >
                <Box className="h-5 w-5 text-pullz-primary-hover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-pullz-text">Featured case: {demoBox.name}</span>
                  <span className="block text-xs text-pullz-text-muted">Open this curated collection</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-center gap-1.5">
        {Array.from({ length: slideCount }).map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Show homepage hero slide ${index + 1}`}
            onClick={() => onSlideSelect(index)}
            className={`h-2 w-2 rounded-full transition duration-220 ${
              index === activeSlide ? 'bg-pullz-primary-hover' : 'bg-pullz-overlay'
            }`}
          />
        ))}
      </div>
    </section>
  );
};
