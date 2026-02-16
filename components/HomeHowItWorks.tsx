import React from 'react';
import { Box, Sparkles, Repeat } from 'lucide-react';

const STEPS = [
  {
    title: 'Pick a box',
    copy: 'Choose a category you love and start from any budget.',
    Icon: Box
  },
  {
    title: 'Open it',
    copy: 'Reveal your pull instantly with transparent drop odds.',
    Icon: Sparkles
  },
  {
    title: 'Keep or sell',
    copy: 'Ship items you want, or sell back for coins in one tap.',
    Icon: Repeat
  }
];

export const HomeHowItWorks: React.FC = () => (
  <section className="space-y-8">
    <h2 className="text-center text-3xl font-black uppercase text-white sm:text-4xl">How it works</h2>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {STEPS.map(({ title, copy, Icon }) => (
        <article
          key={title}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-violet-300/30 bg-violet-400/10 text-violet-100">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold uppercase tracking-wide text-white">{title}</h3>
          <p className="mt-2 text-sm text-gray-300">{copy}</p>
        </article>
      ))}
    </div>
  </section>
);
