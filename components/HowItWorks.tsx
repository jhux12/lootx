import React from 'react';
import { Box, Gift, Truck } from 'lucide-react';

const steps = [
  {
    title: 'Open a case',
    description: 'Choose a box and open instantly.',
    icon: Box,
  },
  {
    title: 'Win real items',
    description: 'Every case reveals a real reward.',
    icon: Gift,
  },
  {
    title: 'Ship or sell back instantly',
    description: 'Deliver it or cash out in seconds.',
    icon: Truck,
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="mt-16 px-4 md:px-0">
      <div className="mb-8 flex flex-col gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">How it works</p>
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Three simple steps</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-1 hover:border-white/20"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/15 text-purple-200">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{step.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
