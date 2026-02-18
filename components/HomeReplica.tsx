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

const CATEGORIES = ['Trading Cards', 'Collectibles', 'Tech & Gaming'];

export const HomeReplica: React.FC<HomeReplicaProps> = ({
  boxes,
  isChatCollapsed,
  onOpenBox,
  onViewAllBoxes,
  onSignUp
}) => {
  const [openFaq, setOpenFaq] = useState(0);

  const featuredBoxes = useMemo(() => boxes.slice(0, 8), [boxes]);
  const chipBoxes = useMemo(() => boxes.slice(0, 18), [boxes]);
  const [demoSpinIndex, setDemoSpinIndex] = useState(0);

  const spinnerReel = useMemo(() => {
    if (featuredBoxes.length === 0) return [];
    return Array.from({ length: 30 }, (_, index) => featuredBoxes[index % featuredBoxes.length]);
  }, [featuredBoxes]);

  useEffect(() => {
    if (spinnerReel.length <= 1) return undefined;
    const intervalId = window.setInterval(() => {
      setDemoSpinIndex((current) => (current + 1) % spinnerReel.length);
    }, 1250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [spinnerReel.length]);

  const spinnerCardWidth = 112;
  const spinnerGap = 10;
  const activeBox = spinnerReel[demoSpinIndex] ?? featuredBoxes[0];

  return (
    <div className={`mx-auto flex w-full flex-col gap-10 px-3 pb-14 pt-6 sm:px-5 lg:px-7 ${isChatCollapsed ? 'max-w-[1240px]' : 'max-w-[1160px]'}`}>
      <section className="mx-auto w-full max-w-[860px] rounded-2xl border border-white/10 bg-[linear-gradient(125deg,#1a1d2b_10%,#1f2231_45%,#171a28_90%)] px-5 py-10 text-center shadow-[0_20px_55px_-35px_rgba(0,0,0,0.95)] sm:px-8">
        <div className="rounded-xl border border-white/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_60%)] px-4 py-7">
          <h1 className="text-3xl font-black uppercase italic tracking-tight text-white sm:text-6xl">
            Fair Value <span className="text-[#c171ff]">Guarantee</span>
          </h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-gray-300 sm:text-sm">
            Discover, open &amp; collect on Pullz
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[860px] rounded-2xl border border-white/10 bg-[#0b0d13] p-3 sm:p-4">
        <p className="pb-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
          Best mystery boxes online
        </p>
        <div className="overflow-hidden rounded-xl border border-[#1f2430] bg-[#0a0d14]">
          <div className="grid min-h-[184px] md:grid-cols-[300px_1fr]">
            <button
              type="button"
              onClick={() => activeBox && onOpenBox(activeBox.id)}
              className="relative flex min-h-[184px] flex-col justify-end overflow-hidden border-b border-[#1f2430] bg-[radial-gradient(circle_at_20%_25%,rgba(78,95,255,0.28),transparent_58%),linear-gradient(180deg,#111728_0%,#0a0d14_100%)] p-4 text-left md:border-b-0 md:border-r"
            >
              {activeBox && (
                <img
                  loading="lazy"
                  decoding="async"
                  src={activeBox.image}
                  alt={activeBox.name}
                  className="pointer-events-none absolute left-6 top-4 h-24 w-24 object-contain opacity-95 sm:h-28 sm:w-28"
                />
              )}
              <p className="relative z-10 text-[30px] font-black uppercase italic leading-none text-white">
                {activeBox?.name ?? 'Iphone 17 Series'}
              </p>
              <div className="relative z-10 mt-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
                <span className="rounded bg-[#5860ff] px-2 py-0.5 text-white">New arrival</span>
                <span className="text-gray-400">Tech &amp; Gaming</span>
              </div>
            </button>

            <div className="relative flex items-center overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
              <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-white/60 shadow-[0_0_14px_rgba(255,255,255,0.42)]" />
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-[#0a0d14] to-transparent sm:w-20" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#0a0d14] to-transparent sm:w-20" />

              <div
                className="flex px-[50%] py-6 will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.18,0.84,0.32,1)]"
                style={{
                  gap: `${spinnerGap}px`,
                  marginLeft: `-${spinnerCardWidth / 2}px`,
                  transform: `translateX(-${demoSpinIndex * (spinnerCardWidth + spinnerGap)}px)`
                }}
              >
                {spinnerReel.map((box, idx) => {
                  const isCenter = idx === demoSpinIndex;
                  return (
                    <button
                      type="button"
                      key={`${box.id}-${idx}`}
                      onClick={() => onOpenBox(box.id)}
                      className={`relative flex h-[112px] w-[112px] flex-shrink-0 flex-col justify-between rounded-xl border px-3 py-2 text-left ${
                        isCenter
                          ? 'border-white/70 bg-[#1a2235] shadow-[0_0_20px_rgba(255,255,255,0.22)]'
                          : 'border-[#2a3040] bg-[#0f1420]'
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-white">{box.name}</p>
                      <div className="h-1 w-full rounded-full bg-white/10" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center border-t border-[#1f2430] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#59d189]">
            ● Live demo mode
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
        <button
          type="button"
          onClick={onSignUp}
          className="text-center text-2xl font-black uppercase text-white sm:text-4xl"
        >
          Get a <span className="text-[#6962ff]">free box</span> when signing up!
        </button>
      </section>

      <section className="-mx-3 overflow-x-auto border-y border-white/10 bg-black/20 px-3 py-2 sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex min-w-max items-stretch gap-2 sm:gap-3">
          <div className="flex w-[54px] shrink-0 flex-col items-center justify-center rounded-md border border-white/15 bg-[#091016] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#60de92]">
            <span>Live</span>
            <span>Drops</span>
          </div>
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
