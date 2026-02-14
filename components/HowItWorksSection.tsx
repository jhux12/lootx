import React from 'react';
import { Box, Sparkles, Repeat } from 'lucide-react';

const steps = [
  {
    id: 'pick',
    title: 'Pick a box',
    description: 'Choose a category you love',
    icon: Box,
    accent: '1.'
  },
  {
    id: 'open',
    title: 'Open it',
    description: 'Reveal your pull instantly',
    icon: Sparkles,
    accent: '2.'
  },
  {
    id: 'trade',
    title: 'Keep or trade',
    description: 'Ship items you like or trade in for credits',
    icon: Repeat,
    accent: '3.'
  }
];

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="scroll-mt-28 space-y-5 py-2 sm:py-4">
      <h2 className="text-center text-4xl font-black uppercase tracking-tight text-white">How it works</h2>
      <div className="space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article
              key={step.id}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f1219] via-[#10141d] to-[#0a0d13] px-4 py-4 sm:px-5"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-gray-200">
                <Icon className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-extrabold uppercase text-white">
                  <span className="mr-1 text-[#ff5a00]">{step.accent}</span>
                  {step.title}
                </h3>
                <p className="text-lg text-gray-300">{step.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
