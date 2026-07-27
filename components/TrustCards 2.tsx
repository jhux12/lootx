import React from 'react';
import { ShieldCheck, Lock, PackageCheck } from 'lucide-react';

const trustItems = [
  {
    title: 'Provably fair',
    description: 'Transparent odds backed by verifiable fairness tooling.',
    icon: ShieldCheck
  },
  {
    title: 'Secure checkout',
    description: 'Encrypted payments with trusted processing partners.',
    icon: Lock
  },
  {
    title: 'Real inventory',
    description: 'Items are in stock and ready to ship when you win.',
    icon: PackageCheck
  }
];

export const TrustCards: React.FC = () => {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Trusted and transparent</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-white/5 bg-[#0b0f17] p-5 text-sm text-gray-400"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-blue-300">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
