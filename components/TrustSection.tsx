import React from 'react';
import { ShieldCheck, CreditCard, PackageCheck } from 'lucide-react';

const trustItems = [
  {
    title: 'Provably fair',
    description: 'Every outcome is verifiable and transparent.',
    icon: ShieldCheck
  },
  {
    title: 'Secure checkout',
    description: 'Encrypted payments with trusted providers.',
    icon: CreditCard
  },
  {
    title: 'Real inventory',
    description: 'Authentic items ready to ship worldwide.',
    icon: PackageCheck
  }
];

export const TrustSection: React.FC = () => {
  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-white/5 bg-[#0a0f18] p-6 sm:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          {trustItems.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/5 bg-[#0d131e] p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
