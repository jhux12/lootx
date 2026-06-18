import React from 'react';

type TrustPageVariant = 'faq' | 'about' | 'shipping' | 'refund';

type TrustSection = {
  heading: string;
  body: string;
};

const pageContent: Record<TrustPageVariant, { title: string; intro: string; sections: TrustSection[] }> = {
  faq: {
    title: 'FAQ',
    intro: 'Quick answers about opening Pullz.gg Pokémon mystery boxes, keeping rewards, and using site credit.',
    sections: [
      { heading: 'What is Pullz.gg?', body: 'Pullz.gg is an online mystery box platform focused on Pokémon collectibles and other reward drops.' },
      { heading: 'Can I keep the items I win?', body: 'Yes. Eligible physical collectibles can be kept and requested for shipment from your inventory.' },
      { heading: 'Can I sell items back?', body: 'Eligible rewards may be sold back for site credit instead of being shipped.' },
      { heading: 'How do I know openings are fair?', body: 'Visit the Provably Fair page to learn how box results can be verified.' }
    ]
  },
  about: {
    title: 'About Pullz.gg',
    intro: 'Pullz.gg helps collectors discover Pokémon mystery boxes online with transparent rewards, account tools, and support.',
    sections: [
      { heading: 'Our focus', body: 'We build collectible-focused mystery box experiences with clear reward displays and simple inventory management.' },
      { heading: 'Collector-first choices', body: 'Users can keep eligible items for shipment or sell them back for site credit where available.' },
      { heading: 'Trust and transparency', body: 'Pullz.gg provides support resources, legal policies, and provably fair information for users reviewing the platform.' }
    ]
  },
  shipping: {
    title: 'Shipping Policy',
    intro: 'This page summarizes how Pullz.gg handles shipment requests for eligible physical collectibles.',
    sections: [
      { heading: 'Eligible items', body: 'Physical items marked as eligible in a user inventory may be requested for shipment.' },
      { heading: 'Shipping details', body: 'Users are responsible for providing accurate shipping information before submitting a shipment request.' },
      { heading: 'Processing', body: 'Shipment processing times can vary based on item availability, destination, carrier service, and account review requirements.' }
    ]
  },
  refund: {
    title: 'Refund Policy',
    intro: 'This page summarizes Pullz.gg refund expectations for purchases, credits, and collectible rewards.',
    sections: [
      { heading: 'Digital purchases', body: 'Site credit purchases and used credits are generally final unless required by applicable law or confirmed support review.' },
      { heading: 'Reward outcomes', body: 'Mystery box outcomes are determined when opened and are not refundable because a user did not receive a preferred item.' },
      { heading: 'Need help?', body: 'Contact support if you believe there was a billing issue, duplicate charge, or shipment problem.' }
    ]
  }
};

export const TrustPage: React.FC<{ variant: TrustPageVariant }> = ({ variant }) => {
  const content = pageContent[variant];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Pullz.gg Help</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{content.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{content.intro}</p>
        <div className="mt-8 grid gap-4">
          {content.sections.map((section) => (
            <article key={section.heading} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-bold text-white">{section.heading}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
