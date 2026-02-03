import React from 'react';
import { PackageOpen, Sparkles, Truck } from 'lucide-react';

const steps = [
  {
    title: 'Open a case',
    description: 'Browse premium boxes and pick your drop.',
    icon: PackageOpen,
  },
  {
    title: 'Win real items',
    description: 'Every case reveals real inventory.',
    icon: Sparkles,
  },
  {
    title: 'Ship or sell back instantly',
    description: 'Cash out or ship your win in seconds.',
    icon: Truck,
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="mt-16">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">How it works</h2>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-2xl border border-white/5 bg-[#0b0f18] p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-cyan-300">
                <Icon className="h-5 w-5" />
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
