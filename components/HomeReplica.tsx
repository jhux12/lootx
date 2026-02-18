import React, { useEffect, useMemo, useState } from 'react';
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
  const [demoSpinIndex, setDemoSpinIndex] = useState(0);

  const spinnerReel = useMemo(() => {
    if (featuredBoxes.length === 0) return [];
    return Array.from({ length: 18 }, (_, index) => featuredBoxes[index % featuredBoxes.length]);
  }, [featuredBoxes]);

  useEffect(() => {
    if (spinnerReel.length <= 1) return undefined;
    const intervalId = window.setInterval(() => {
      setDemoSpinIndex((current) => (current + 1) % spinnerReel.length);
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [spinnerReel.length]);

  const spinnerCardWidth = 120;
  const spinnerGap = 12;
  const activeBox = spinnerReel[demoSpinIndex] ?? featuredBoxes[0];

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
        <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-[#0b0e14] p-1 shadow-2xl">
          <div className="relative flex h-52 items-center overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] sm:h-60">
            <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-cyan-400/35" />
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-14 bg-gradient-to-r from-[#0b0e14] to-transparent sm:w-24" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-14 bg-gradient-to-l from-[#0b0e14] to-transparent sm:w-24" />

            <div
              className="flex px-[50%] will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.18,0.84,0.32,1)]"
              style={{
                gap: `${spinnerGap}px`,
                marginLeft: `-${spinnerCardWidth / 2}px`,
                transform: `translateX(-${demoSpinIndex * (spinnerCardWidth + spinnerGap)}px)`
              }}
            >
              {spinnerReel.map((box, idx) => (
                <button
                  type="button"
                  key={`${box.id}-${idx}`}
                  onClick={() => onOpenBox(box.id)}
                  className="relative flex h-[120px] w-[120px] flex-shrink-0 flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#151a23] p-3"
                >
                  <div
                    className="absolute inset-4 rounded-full opacity-90"
                    style={{
                      background: `radial-gradient(circle, ${(box.accentColor || '#7e76ff')}75 0%, ${(box.accentColor || '#7e76ff')}2d 45%, ${(box.accentColor || '#7e76ff')}00 78%)`
                    }}
                  />
                  <img
                    loading="lazy"
                    decoding="async"
                    src={box.image}
                    alt={box.name}
                    className="relative z-10 h-14 w-14 object-contain"
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl opacity-60"
                    style={{ backgroundColor: box.accentColor || '#7e76ff' }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-800 bg-[#0b0e14] p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#c9c5ff] sm:text-xs">
              Demo spinner (same style as unboxing reel)
            </p>
            <button
              type="button"
              onClick={() => activeBox && onOpenBox(activeBox.id)}
              className="rounded-md bg-[#5a55ff] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#6d68ff]"
            >
              Open shown box
            </button>
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
