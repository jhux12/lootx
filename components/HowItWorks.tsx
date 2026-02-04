import React from 'react';
import { Box, Sparkles, Truck } from 'lucide-react';

const steps = [
  {
    title: 'Open a case',
    description: 'Pick from curated boxes and crack them open instantly.',
    icon: Box
  },
  {
    title: 'Win real items',
    description: 'Every case contains real inventory with transparent odds.',
    icon: Sparkles
  },
  {
    title: 'Ship or sell back instantly',
    description: 'Send items to your door or sell them back in seconds.',
    icon: Truck
  }
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="scroll-mt-28">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-white">How it works</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-2xl border border-white/5 bg-[#0c111b] p-5 transition hover:border-white/15"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-cyan-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{step.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
