import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MysteryBox } from '../types';
import { LiveTicker } from './LiveTicker';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is Pullz?',
    answer:
      'Pullz is an online mystery box platform where every item is a real, physical product. You can open a box, then either ship your item or trade it for credits.'
  },
  {
    question: 'What are Credits?',
    answer:
      'Credits are your in-app balance used to open mystery boxes. You can add credits from the top-up section and use them instantly across categories.'
  },
  {
    question: 'How can I redeem my items?',
    answer:
      'After opening a box, go to your inventory and choose ship to deliver the item, or trade to convert it back to credits for more openings.'
  },
  {
    question: 'Can I get my items shipped?',
    answer:
      'Yes. Shippable items can be delivered to your saved address. Shipping options and costs are shown clearly before confirmation.'
  },
  {
    question: 'What is the Fair Value Guarantee?',
    answer:
      'Our Fair Value Guarantee means every opening has transparent odds and expected value calibration designed for a consistent player experience.'
  }
];

const CATEGORIES = [
  'Trading Cards',
  'Collectibles',
  'Tech & Gaming'
];

export const HomeReplica: React.FC<HomeReplicaProps> = ({
  boxes,
  isChatCollapsed,
  onOpenBox,
  onViewAllBoxes,
  onSignUp
}) => {
  const [openFaq, setOpenFaq] = useState(0);

  const featuredBoxes = useMemo(() => boxes.slice(0, 6), [boxes]);
  const chipBoxes = useMemo(() => boxes.slice(0, 18), [boxes]);

  return (
    <div className={`mx-auto flex w-full flex-col gap-10 px-3 pb-14 pt-6 sm:px-5 lg:px-7 ${isChatCollapsed ? 'max-w-[1240px]' : 'max-w-[1160px]'}`}>
      <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#181a25] via-[#1b1d2a] to-[#181a25] px-5 py-9 text-center sm:px-8">
        <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
          Fair Value <span className="text-[#6f67ff]">Guarantee</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-gray-400 sm:text-sm">
          Discover, open &amp; collect on Pullz
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b0d13] p-3 sm:p-4">
        <p className="pb-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
          Best mystery boxes online
        </p>
        <div className="grid gap-3 md:grid-cols-[minmax(220px,0.9fr)_1.8fr]">
          <button
            type="button"
            onClick={() => featuredBoxes[0] && onOpenBox(featuredBoxes[0].id)}
            className="group relative overflow-hidden rounded-xl border border-[#2f49ff33] bg-gradient-to-br from-[#13172a] to-[#0b0f1f] p-4 text-left"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Featured</p>
            <p className="mt-16 text-2xl font-extrabold uppercase italic text-white">
              {featuredBoxes[0]?.name ?? 'Iphone 17 Series'}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[#7784ff]">New arrival</p>
            <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(111,103,255,0.28),transparent_55%)]" />
          </button>

          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2 sm:gap-3">
              {featuredBoxes.map((box, index) => (
                <button
                  type="button"
                  key={box.id}
                  onClick={() => onOpenBox(box.id)}
                  className={`w-[140px] shrink-0 rounded-xl border px-3 py-4 text-left transition ${
                    index === 2
                      ? 'border-white/60 bg-white/5 shadow-[0_0_22px_rgba(255,255,255,0.14)]'
                      : 'border-white/15 bg-black/30 hover:border-white/35'
                  }`}
                >
                  <p className="line-clamp-2 text-sm font-semibold text-white">{box.name}</p>
                  <p className="mt-5 text-[11px] uppercase tracking-[0.12em] text-gray-400">Tap to open</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onViewAllBoxes}
          className="rounded-lg bg-[#5a55ff] px-8 py-3 text-sm font-extrabold uppercase tracking-[0.09em] text-white transition hover:bg-[#6d68ff]"
        >
          View all boxes
        </button>
        <p className="text-center text-xl font-black uppercase text-white sm:text-3xl">
          Get a <span className="text-[#6962ff]">free box</span> when signing up!
        </p>
        <button
          type="button"
          onClick={onSignUp}
          className="rounded-md border border-[#6962ff66] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#a9a5ff] hover:bg-[#6962ff1f]"
        >
          Claim offer
        </button>
      </section>

      <section className="-mx-3 overflow-x-auto border-y border-white/10 bg-black/20 px-3 py-2 sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex min-w-max gap-2 sm:gap-3">
          {chipBoxes.map((box) => (
            <button
              type="button"
              key={`chip-${box.id}`}
              onClick={() => onOpenBox(box.id)}
              className="rounded-md border border-white/15 bg-[#0f1118] px-3 py-2 text-left"
            >
              <p className="max-w-[100px] truncate text-xs font-semibold text-white">{box.name}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Mystery box</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((category) => (
          <article
            key={category}
            className="group flex min-h-[200px] flex-col justify-end rounded-2xl border border-white/10 bg-gradient-to-b from-[#121520] to-[#0a0c12] p-5"
          >
            <p className="flex items-center gap-2 text-2xl font-black uppercase italic text-white">
              {category}
              <span className="rounded-full border border-white/20 p-1 text-gray-300 transition group-hover:border-white/50 group-hover:text-white">
                <ChevronRight size={14} />
              </span>
            </p>
          </article>
        ))}
      </section>

      <section>
        <h2 className="text-center text-3xl font-black uppercase text-white sm:text-4xl">
          How it <span className="text-[#6962ff]">works</span>
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ['01', 'Pick a box', 'Choose a category you love'],
            ['02', 'Open it', 'Reveal your pull instantly'],
            ['03', 'Keep or trade', 'Ship items or convert to credits']
          ].map(([num, title, description]) => (
            <article
              key={num}
              className="rounded-2xl border border-white/10 bg-[#0d0f16] p-6 text-center"
            >
              <p className="text-5xl font-black text-white/10">{num}</p>
              <p className="mt-5 text-2xl font-extrabold uppercase text-white">{title}</p>
              <p className="mt-2 text-sm text-gray-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl">
        <h2 className="text-center text-3xl font-black uppercase text-white sm:text-4xl">
          Frequently asked <span className="text-[#6962ff]">questions</span>
        </h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f16]">
          {FAQ_ITEMS.map((item, index) => {
            const expanded = openFaq === index;
            return (
              <div key={item.question} className="border-b border-white/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(expanded ? -1 : index)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left sm:px-6"
                >
                  <span className="text-sm font-bold text-white sm:text-base">{item.question}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <p className="px-4 pb-4 text-sm text-gray-300 sm:px-6 sm:pb-6">{item.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0d0f16] p-6 sm:p-8">
        <h3 className="text-2xl font-black text-white">Mystery Boxes for Sale by Category</h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Pullz is an online mystery box website where you can buy mystery boxes across multiple categories, from
          tech and gaming setups to trading cards, collectibles, anime and more.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-300 marker:text-[#6962ff]">
          <li>Trading cards, collector packs and rare sealed products.</li>
          <li>Gaming gear, phones, accessories and desk essentials.</li>
          <li>Figures, lifestyle items and fan-favorite collectibles.</li>
        </ul>
        <button
          type="button"
          onClick={onViewAllBoxes}
          className="mt-6 rounded-lg bg-[#5a55ff] px-8 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#6d68ff]"
        >
          View all boxes
        </button>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Live drops</p>
        <LiveTicker />
      </section>
    </div>
  );
};
