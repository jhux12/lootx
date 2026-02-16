import React from 'react';
import { Lock, PackageCheck, ShieldCheck } from 'lucide-react';
import { MobileFeatureStrip, MobileFeatureItem } from './MobileFeatureStrip';

const trustItems = [
  {
    id: 'provably-fair',
    title: 'Provably fair',
    label: 'Fairness first',
    description: 'Verifiable outcomes with transparent tooling for confidence in every opening.',
    icon: ShieldCheck,
    cta: {
      label: 'Learn more',
      href: '#how-it-works'
    }
  },
  {
    id: 'secure-checkout',
    title: 'Secure checkout',
    label: 'Protected payment flow',
    description: 'Encrypted transactions with trusted processors and robust account safeguards.',
    icon: Lock,
    cta: {
      label: 'Payment safety',
      href: '#how-it-works'
    }
  },
  {
    id: 'real-inventory',
    title: 'Real inventory',
    label: 'Physical rewards',
    description: 'Drops map to real stock so winners can ship quickly without delays.',
    icon: PackageCheck,
    cta: {
      label: 'How shipping works',
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
        <h2 className="text-2xl font-semibold text-white">Built for trust at every step</h2>
      </div>
      <MobileFeatureStrip items={mobileItems} />
      <div className="hidden gap-4 md:grid md:grid-cols-3 md:gap-6">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1525] to-[#0a101b] p-5 text-sm text-gray-300 shadow-[0_15px_40px_-35px_rgba(125,211,252,0.55)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-cyan-200">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">{item.label}</div>
              <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
};
