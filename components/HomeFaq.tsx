import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'What is Pullz?',
    a: 'Pullz is a mystery box platform where you open curated digital cases for real products and instant coin value.'
  },
  {
    q: 'What are Coins?',
    a: 'Coins are your on-site balance used to open boxes, enter experiences, and manage sell-back choices.'
  },
  {
    q: 'How do I redeem my items?',
    a: 'After opening a box, items appear in your inventory where you can choose to keep, redeem, or sell back.'
  },
  {
    q: 'Can I get items shipped?',
    a: 'Yes. Eligible inventory items can be shipped to your saved address during checkout in the inventory flow.'
  },
  {
    q: 'How does Provably Fair work?',
    a: 'Every roll is generated using a verifiable fairness system so outcomes can be independently checked.'
  }
];

export const HomeFaq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="space-y-4">
      <h2 className="text-center text-3xl font-black text-white sm:text-4xl">FAQ</h2>
      <div className="space-y-3">
        {FAQS.map((faq, index) => {
          const open = openIndex === index;
          return (
            <article key={faq.q} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                aria-expanded={open}
              >
                <span className="text-base font-semibold text-white">{faq.q}</span>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <p className="overflow-hidden px-5 pb-4 text-sm text-gray-300">{faq.a}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
