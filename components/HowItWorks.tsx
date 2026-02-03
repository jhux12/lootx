import React from 'react';
import { Box, Sparkles, Truck } from 'lucide-react';

const steps = [
  {
    title: 'Open a case',
    description: 'Pick a box and reveal what’s inside in seconds.',
    icon: Box
  },
  {
    title: 'Win real items',
    description: 'Every case contains authentic rewards with real value.',
    icon: Sparkles
  },
  {
    title: 'Ship or sell back instantly',
    description: 'Ship to your door or sell for instant balance.',
    icon: Truck
  }
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="mt-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/70">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Three simple steps</h2>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-white/5 bg-[#0b111b] p-6 transition-transform hover:-translate-y-1"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
              <step.icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm text-gray-400">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
