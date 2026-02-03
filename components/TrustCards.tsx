import React from 'react';
import { ShieldCheck, CreditCard, PackageCheck } from 'lucide-react';

const trustItems = [
  {
    title: 'Provably fair',
    description: 'Transparent odds with verifiable results.',
    icon: ShieldCheck,
  },
  {
    title: 'Secure checkout',
    description: 'Encrypted payments and trusted providers.',
    icon: CreditCard,
  },
  {
    title: 'Real inventory',
    description: 'Authentic items shipped worldwide.',
    icon: PackageCheck,
  },
];

export const TrustCards: React.FC = () => {
  return (
    <section className="mt-16 px-4 md:px-0">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Trust & fairness</p>
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Built for confidence</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-[#0b0f18] p-6 text-left text-sm text-gray-400 transition hover:border-white/20 hover:text-gray-200"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-200">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
