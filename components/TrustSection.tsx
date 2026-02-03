import React from 'react';
import { ShieldCheck, CreditCard, PackageCheck } from 'lucide-react';

const trustItems = [
  {
    title: 'Provably fair',
    description: 'Every result is verifiable and transparent.',
    icon: ShieldCheck,
  },
  {
    title: 'Secure checkout',
    description: 'Trusted payment providers and encryption.',
    icon: CreditCard,
  },
  {
    title: 'Real inventory',
    description: 'Authentic items shipped fast or sold back.',
    icon: PackageCheck,
  },
];

export const TrustSection: React.FC = () => {
  return (
    <section className="mt-16">
      <div className="grid gap-4 md:grid-cols-3">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-white/5 bg-[#0a0e16] p-5 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-purple-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
