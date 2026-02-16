import React from 'react';
import { Box, Sparkles, Truck } from 'lucide-react';
import { MobileFeatureStrip, MobileFeatureItem } from './MobileFeatureStrip';

const steps = [
  {
    id: 'open-case',
    title: 'Pick your case',
    label: 'Step 1',
    description: 'Browse themed boxes and launch your opening instantly from any device.',
    icon: Box,
    cta: {
      label: 'Browse boxes',
      href: '/boxes'
    }
  },
  {
    id: 'win-items',
    title: 'Reveal your drop',
    label: 'Step 2',
    description: 'Every outcome follows transparent odds, with live reveal moments for excitement.',
    icon: Sparkles
  },
  {
    id: 'ship-or-sell',
    title: 'Ship or sell back',
    label: 'Step 3',
    description: 'Send your rewards to your address or convert them to balance in seconds.',
    icon: Truck,
    cta: {
      label: 'Open a box',
      href: '/boxes'
    }
  }
];

export const HowItWorksSection: React.FC = () => {
  const mobileItems: MobileFeatureItem[] = steps.map((step) => {
    const Icon = step.icon;
    return {
      id: step.id,
      title: step.title,
      label: step.label,
      description: step.description,
      icon: <Icon className="h-4 w-4" />,
      cta: step.cta
    };
  });

  return (
    <section id="how-it-works" className="scroll-mt-28 py-6 sm:py-8">
      <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
        <h2 className="text-2xl font-semibold text-white">How it works</h2>
      </div>
      <MobileFeatureStrip items={mobileItems} showStepIndex />
      <div className="hidden gap-4 md:grid md:grid-cols-3 md:gap-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article
              key={step.id}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1525] via-[#0b1320] to-[#09101b] p-5 transition hover:border-cyan-300/35"
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">Step {index + 1}</div>
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-cyan-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{step.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
};
