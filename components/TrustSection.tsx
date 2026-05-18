import React from 'react';
import { Lock, PackageCheck, ShieldCheck } from 'lucide-react';
import { MobileFeatureStrip, MobileFeatureItem } from './MobileFeatureStrip';

const trustItems = [
  {
    id: 'provably-fair',
    title: 'Provably fair',
    label: 'Provably fair',
    description: 'Transparent odds backed by verifiable fairness tooling.',
    icon: ShieldCheck,
    cta: {
      label: 'Learn more',
      href: '#how-it-works'
    }
  },
  {
    id: 'secure-checkout',
    title: 'Secure checkout',
    label: 'Secure checkout',
    description: 'Encrypted payments with trusted processing partners.',
    icon: Lock,
    cta: {
      label: 'Learn more',
      href: '#how-it-works'
    }
  },
  {
    id: 'real-inventory',
    title: 'Real inventory',
    label: 'Real inventory',
    description: 'Items are in stock and ready to ship when you win.',
    icon: PackageCheck,
    cta: {
      label: 'Learn more',
      href: '#how-it-works'
    }
  }
];

export const TrustSection: React.FC = () => {
  const mobileItems: MobileFeatureItem[] = trustItems.map((item) => {
    const Icon = item.icon;
    return {
      id: item.id,
      title: item.title,
      label: item.label,
      description: item.description,
      icon: <Icon className="h-4 w-4" />,
      cta: item.cta
    };
  });

  return (
    <section className="py-6 sm:py-8">
      <div className="mb-5 flex items-center justify-between sm:mb-6">
        <h2 className="text-2xl font-semibold text-white">Trusted and transparent</h2>
      </div>
      <MobileFeatureStrip items={mobileItems} />
      <div className="hidden gap-4 md:grid md:grid-cols-3 md:gap-6">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
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
