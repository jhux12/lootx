import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CaseItem, MysteryBox } from '../types';
import { TopDropsSlider } from './TopDropsSlider';
import { useGame } from '../context/GameContext';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
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
  demoBoxId,
  isChatCollapsed,
  onOpenBox,
  onViewAllBoxes,
  onSignUp
}) => {
  const { stripeSettings, setView } = useGame();
  const [openFaq, setOpenFaq] = useState(0);

  const featuredBoxes = useMemo(() => boxes.slice(0, 8), [boxes]);
  const showcaseBox = useMemo(() => {
    if (demoBoxId) {
      const matched = boxes.find((box) => box.id === demoBoxId);
      if (matched) return matched;
    }
    return featuredBoxes[0];
  }, [boxes, demoBoxId, featuredBoxes]);

  const [demoSpinIndex, setDemoSpinIndex] = useState(10);
  const [isSpinAnimating, setIsSpinAnimating] = useState(false);

  const spinnerItems = useMemo<CaseItem[]>(() => {
    if (!showcaseBox?.items?.length) return [];
    return Array.from({ length: 160 }, (_, index) => showcaseBox.items[index % showcaseBox.items.length]);
  }, [showcaseBox]);

  useEffect(() => {
    setDemoSpinIndex(10);
  }, [showcaseBox?.id]);

  useEffect(() => {
    if (spinnerItems.length <= 1) return undefined;

    const runDemoSpin = () => {
      const travel = 12 + Math.floor(Math.random() * 9);
      setIsSpinAnimating(true);
      setDemoSpinIndex((current) => {
        const safeCurrent = current > spinnerItems.length - 28 ? 10 : current;
        return Math.min(safeCurrent + travel, spinnerItems.length - 1);
      });
      window.setTimeout(() => {
        setIsSpinAnimating(false);
      }, 2300);
    };

    runDemoSpin();
    const intervalId = window.setInterval(runDemoSpin, 5200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [spinnerItems.length]);

  const spinnerCardWidth = 118;
  const spinnerGap = 11;

  const handleCategoryCardClick = (index: number) => {
    const slug = stripeSettings.homeCategorySlugs[index]?.trim();
    if (!slug) {
      onViewAllBoxes();
      return;
    }

    const params = new URLSearchParams();
    params.set('category', slug);
    window.history.replaceState({}, '', `/boxes?${params.toString()}`);
    setView({ type: 'BOXES' });
  };

  return (
    <div className={`mx-auto flex w-full flex-col gap-10 px-3 pb-14 pt-6 sm:px-5 lg:px-7 ${isChatCollapsed ? 'max-w-[1240px]' : 'max-w-[1160px]'}`}>
      <section className="mx-auto w-full max-w-[920px] rounded-3xl border border-white/10 bg-[#151922] p-0 shadow-[0_35px_70px_-50px_rgba(0,0,0,1)]">
        <div className="relative overflow-hidden rounded-3xl px-4 py-8 text-center sm:px-10 sm:py-11">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_35%,rgba(0,0,0,0.12)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(58deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_2px,transparent_2px,transparent_44px),repeating-linear-gradient(-58deg,rgba(255,255,255,0.045)_0,rgba(255,255,255,0.045)_2px,transparent_2px,transparent_44px)] opacity-25" />
          <h1 className="relative text-3xl font-black uppercase italic leading-none tracking-tight text-white sm:text-6xl">
            Fair Value <span className="bg-gradient-to-r from-[#6f7dff] via-[#8f67ff] to-[#ec68c8] bg-clip-text text-transparent">Guarantee</span>
          </h1>
          <p className="relative mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300 sm:text-lg sm:tracking-[0.18em]">
            Discover, open &amp; collect on Pullz
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[980px] rounded-3xl border border-white/10 bg-[#0b0d13] p-3 sm:p-4">
        <p className="pb-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
          Best mystery boxes online
        </p>
        <div className="overflow-hidden rounded-3xl border border-[#242a38] bg-[#090c13]">
          <div className="grid min-h-[240px] md:grid-cols-[360px_1fr]">
            <button
              type="button"
              onClick={() => showcaseBox && onOpenBox(showcaseBox.id)}
              className="relative flex min-h-[320px] flex-col items-center justify-end overflow-hidden border-b border-[#242a38] bg-[radial-gradient(circle_at_30%_20%,rgba(81,104,255,0.32),transparent_52%),radial-gradient(circle_at_72%_70%,rgba(249,134,36,0.22),transparent_62%),linear-gradient(180deg,#12192b_0%,#0a0d15_100%)] p-5 text-center md:min-h-[240px] md:items-start md:border-b-0 md:border-r md:text-left"
            >
              <div className="pointer-events-none absolute left-1/2 top-[150px] h-10 w-44 -translate-x-1/2 rounded-full bg-orange-400/45 blur-xl md:left-[110px] md:top-[118px] md:w-36 md:translate-x-0" />
              {showcaseBox && (
                <img
                  loading="lazy"
                  decoding="async"
                  src={showcaseBox.image}
                  alt={showcaseBox.name}
                  className="pointer-events-none absolute left-1/2 top-7 h-44 w-44 -translate-x-1/2 object-contain opacity-100 sm:h-52 sm:w-52 md:left-7 md:top-5 md:h-36 md:w-36 md:translate-x-0"
                />
              )}
              <p className="relative z-10 line-clamp-2 text-[50px] font-black uppercase italic leading-[0.88] tracking-tight text-white sm:text-[56px] md:text-[40px]">
                {showcaseBox?.name ?? 'Iphone 17 Series'}
              </p>
              <div className="relative z-10 mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                <span className="rounded bg-[#5f64ff] px-2 py-1 text-white">New arrival</span>
                <span className="text-gray-400">Sneakers</span>
              </div>
            </button>

            <div className="relative flex items-center overflow-hidden bg-[linear-gradient(180deg,#0a0d14_0%,#07090e_100%)]">
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-14 bg-gradient-to-r from-[#090c13] to-transparent sm:w-20" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-14 bg-gradient-to-l from-[#090c13] to-transparent sm:w-20" />

              <div
                className={`flex px-[50%] py-6 will-change-transform transition-transform ${isSpinAnimating ? 'duration-[2300ms] ease-[cubic-bezier(0.1,0.92,0.23,1)]' : 'duration-300 ease-linear'}`}
                style={{
                  gap: `${spinnerGap}px`,
                  marginLeft: `-${spinnerCardWidth / 2}px`,
                  transform: `translateX(-${demoSpinIndex * (spinnerCardWidth + spinnerGap)}px)`
                }}
              >
                {spinnerItems.map((item, idx) => {
                  const isCenter = idx === demoSpinIndex;
                  const borderTone = idx % 2 === 0 ? '#f28b2f' : '#9b47ff';
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className={`relative flex h-[118px] w-[118px] flex-shrink-0 flex-col items-center justify-center rounded-2xl border bg-[#111827] p-2 transition ${
                        isCenter
                          ? 'border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.35)]'
                          : 'border-[#2a3040]'
                      }`}
                      style={{
                        boxShadow: isCenter ? undefined : `inset 0 0 0 1px ${borderTone}66`
                      }}
                    >
                      <img
                        loading="lazy"
                        decoding="async"
                        src={item.image}
                        alt={item.name}
                        className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                      />
                      <p className="mt-2 line-clamp-2 text-center text-sm font-semibold leading-tight text-white">{item.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center border-t border-[#242a38] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#59d189]">
            ● Live demo mode
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onViewAllBoxes}
          className="rounded-xl bg-[#5a55ff] px-10 py-3 text-sm font-extrabold uppercase tracking-[0.09em] text-white transition hover:bg-[#6d68ff]"
        >
          View all boxes
        </button>
        <button
          type="button"
          onClick={onSignUp}
          className="text-center text-2xl font-black uppercase text-white sm:text-4xl"
        >
          Deposit now and get a <span className="text-[#6962ff]">free</span> mystery box!
        </button>
      </section>

      <section className="w-full">
        <TopDropsSlider boxes={boxes} onOpenBox={onOpenBox} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((category, index) => {
          const categoryImage = stripeSettings.homeCategoryImageUrls[index]?.trim();
          return (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryCardClick(index)}
              className="group relative flex min-h-[200px] w-full flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#121520] to-[#0a0c12] p-5 text-left transition hover:border-white/30"
            >
              {categoryImage ? (
                <img src={categoryImage} alt={category} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />
              <p className="relative z-10 flex items-center gap-2 text-2xl font-black uppercase italic text-white">
                {category}
                <span className="rounded-full border border-white/20 p-1 text-gray-300 transition group-hover:border-white/50 group-hover:text-white">
                  <ChevronRight size={14} />
                </span>
              </p>
            </button>
          );
        })}
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
          ].map(([num, title, description], index) => {
            const stepImage = stripeSettings.howItWorksStepImageUrls[index]?.trim();
            return (
              <article
                key={num}
                className="rounded-2xl border border-white/10 bg-[#0d0f16] p-6 text-center"
              >
                {stepImage ? (
                  <img
                    src={stepImage}
                    alt={`Step ${index + 1}`}
                    className="mx-auto h-36 w-full max-w-[260px] rounded-xl object-cover sm:h-44"
                    loading="lazy"
                  />
                ) : (
                  <p className="text-5xl font-black text-white/10">{num}</p>
                )}
                <p className="mt-5 text-2xl font-extrabold uppercase text-white">{title}</p>
                <p className="mt-2 text-sm text-gray-400">{description}</p>
              </article>
            );
          })}
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

    </div>
  );
};
