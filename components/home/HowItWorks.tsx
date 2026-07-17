import { Box, Sparkles, Truck } from 'lucide-react';
import { PullzSectionHeader } from '../ui/PullzSectionHeader';
import { PullzSurface } from '../ui/PullzSurface';

const steps = [
  {
    icon: Box,
    title: 'Choose a Collection',
    body: 'Browse curated collectible cases.'
  },
  {
    icon: Sparkles,
    title: 'Open Your Pull',
    body: 'Reveal your collectible instantly.'
  },
  {
    icon: Truck,
    title: 'Keep, Ship, or Sell',
    body: 'Choose what happens to the item.'
  }
];

export const HowItWorks = () => (
  <section
    id="mobile-how-it-works"
    className="scroll-mt-4 mt-7 px-3 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
  >
    <div className="mx-auto max-w-[1180px]">
      <PullzSectionHeader eyebrow="How it works" title="Collecting, made simple" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <PullzSurface key={step.title} className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:flex-col">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-pullz-sm bg-pullz-primary-soft text-pullz-primary-hover">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pullz-text-muted">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-pullz-text">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-pullz-text-secondary">{step.body}</p>
                </div>
              </div>
            </PullzSurface>
          );
        })}
      </div>
    </div>
  </section>
);
