import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CaseItem, MysteryBox } from '../types';
import { TopDropsSlider } from './TopDropsSlider';
import { CoinAmount } from './CoinAmount';
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
      'Pullz is an online mystery box platform where every item is a real, physical product. You can open a box, then either ship your item or trade it for coins.'
  },
  {
    question: 'What are Coins?',
    answer:
      'Coins are your in-app balance used to open mystery boxes. You can add coins from the top-up section and use them instantly across categories.'
  },
  {
    question: 'How can I redeem my items?',
    answer:
      'After opening a box, go to your inventory and choose ship to deliver the item, or trade to convert it back to coins for more openings.'
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

  const [demoSpinIndex, setDemoSpinIndex] = useState(14);
  const [isSpinAnimating, setIsSpinAnimating] = useState(false);
  const [demoReelItems, setDemoReelItems] = useState<CaseItem[]>([]);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const spinStartTimeoutRef = useRef<number | null>(null);
  const spinStopTimeoutRef = useRef<number | null>(null);
  const spinReplayTimeoutRef = useRef<number | null>(null);
  const demoSpinIndexRef = useRef(14);
  const spinnerTrackRef = useRef<HTMLDivElement | null>(null);
  const spinnerCardRef = useRef<HTMLDivElement | null>(null);

  const SPINNER_CARD_WIDTH = 170;
  const SPINNER_CARD_GAP = 4;
  const SPINNER_DURATION_MS = 5200;
  const SPINNER_REPLAY_DELAY_MS = 800;
  const SPINNER_TRAVEL_MIN = 18;
  const SPINNER_TRAVEL_MAX = 26;
  const INITIAL_REEL_LENGTH = 140;

  const spinnerItems = useMemo<CaseItem[]>(() => showcaseBox?.items ?? [], [showcaseBox]);
  const [spinnerCardWidth, setSpinnerCardWidth] = useState(SPINNER_CARD_WIDTH);
  const [spinnerCardGap, setSpinnerCardGap] = useState(SPINNER_CARD_GAP);

  useEffect(() => {
    const measureSpinnerTrack = () => {
      const measuredWidth = spinnerCardRef.current?.offsetWidth;
      const trackStyle = spinnerTrackRef.current ? window.getComputedStyle(spinnerTrackRef.current) : null;
      const measuredGap = trackStyle ? Number.parseFloat(trackStyle.columnGap || trackStyle.gap || `${SPINNER_CARD_GAP}`) : NaN;

      if (measuredWidth && Number.isFinite(measuredWidth)) {
        setSpinnerCardWidth(measuredWidth);
      }

      if (Number.isFinite(measuredGap)) {
        setSpinnerCardGap(measuredGap);
      }
    };

    measureSpinnerTrack();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureSpinnerTrack);
      return () => window.removeEventListener('resize', measureSpinnerTrack);
    }

    const resizeObserver = new ResizeObserver(() => {
      measureSpinnerTrack();
    });

    if (spinnerTrackRef.current) {
      resizeObserver.observe(spinnerTrackRef.current);
    }

    if (spinnerCardRef.current) {
      resizeObserver.observe(spinnerCardRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [demoReelItems.length]);

  useEffect(() => {
    const clearSpinTimers = () => {
      if (spinStartTimeoutRef.current) {
        window.clearTimeout(spinStartTimeoutRef.current);
        spinStartTimeoutRef.current = null;
      }
      if (spinStopTimeoutRef.current) {
        window.clearTimeout(spinStopTimeoutRef.current);
        spinStopTimeoutRef.current = null;
      }
      if (spinReplayTimeoutRef.current) {
        window.clearTimeout(spinReplayTimeoutRef.current);
        spinReplayTimeoutRef.current = null;
      }
    };

    clearSpinTimers();

    if (spinnerItems.length === 0) {
      setDemoReelItems([]);
      setDemoSpinIndex(0);
      demoSpinIndexRef.current = 0;
      setLandedIndex(null);
      setIsSpinAnimating(false);
      return undefined;
    }

    const pickRandomItem = () => spinnerItems[Math.floor(Math.random() * spinnerItems.length)];

    const runDemoSpin = () => {
      const legendaryPool = spinnerItems.filter((item) => String(item.rarity ?? '').toLowerCase() === 'legendary');
      const winnerPool = legendaryPool.length > 0 ? legendaryPool : spinnerItems;
      const winner = winnerPool[Math.floor(Math.random() * winnerPool.length)];
      const travel = SPINNER_TRAVEL_MIN + Math.floor(Math.random() * (SPINNER_TRAVEL_MAX - SPINNER_TRAVEL_MIN + 1));
      const targetIndex = demoSpinIndexRef.current + travel;

      setDemoReelItems((previous) => {
        const next = previous.length > 0 ? [...previous] : Array.from({ length: INITIAL_REEL_LENGTH }, pickRandomItem);

        while (next.length <= targetIndex + 12) {
          next.push(pickRandomItem());
        }

        next[targetIndex] = winner;
        return next;
      });

      setIsSpinAnimating(false);
      setLandedIndex(null);

      spinStartTimeoutRef.current = window.setTimeout(() => {
        setIsSpinAnimating(true);
        setDemoSpinIndex(targetIndex);
        demoSpinIndexRef.current = targetIndex;
      }, 90);

      spinStopTimeoutRef.current = window.setTimeout(() => {
        setIsSpinAnimating(false);
        setLandedIndex(targetIndex);
        spinReplayTimeoutRef.current = window.setTimeout(runDemoSpin, SPINNER_REPLAY_DELAY_MS);
      }, SPINNER_DURATION_MS + 90);
    };

    const initialReel = Array.from({ length: INITIAL_REEL_LENGTH }, pickRandomItem);
    setDemoReelItems(initialReel);
    setDemoSpinIndex(14);
    demoSpinIndexRef.current = 14;
    setLandedIndex(null);

    spinReplayTimeoutRef.current = window.setTimeout(runDemoSpin, 250);

    return () => {
      clearSpinTimers();
    };
  }, [spinnerItems]);


  const fairValueBannerKeyframes = `
    @keyframes fairValueGlow {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.7; }
      50% { transform: translate3d(6%, -2%, 0) scale(1.08); opacity: 1; }
    }

    @keyframes fairValueFloat {
      0%, 100% { transform: translate3d(0, 0, 0); }
      50% { transform: translate3d(0, -10px, 0); }
    }

    @keyframes fairValueShimmer {
      0% { transform: translateX(-140%); }
      100% { transform: translateX(140%); }
    }
  `;

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
      <style>{fairValueBannerKeyframes}</style>
      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-white/10 bg-[#11151f] shadow-[0_35px_70px_-50px_rgba(0,0,0,1)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,#121827_0%,#171b2b_32%,#11151f_58%,#0f1320_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-[-10%] hidden w-[38%] bg-[radial-gradient(circle,rgba(111,125,255,0.32)_0%,rgba(111,125,255,0.08)_42%,transparent_72%)] sm:block sm:animate-[fairValueGlow_8s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute right-[-8%] top-[-15%] hidden h-[150%] w-[38%] bg-[radial-gradient(circle,rgba(236,104,200,0.24)_0%,rgba(236,104,200,0.08)_38%,transparent_70%)] sm:block sm:animate-[fairValueFloat_10s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(58deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_2px,transparent_2px,transparent_44px),repeating-linear-gradient(-58deg,rgba(255,255,255,0.045)_0,rgba(255,255,255,0.045)_2px,transparent_2px,transparent_44px)] opacity-20" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1240px] px-4 pt-8 text-left sm:px-6 sm:pt-10 lg:px-8">
          <div className="relative z-10 flex w-full items-end justify-between gap-3 sm:gap-5 lg:min-h-[360px] lg:items-center lg:pr-[18rem]">
            <div className="flex min-w-0 flex-1 flex-col items-start pb-6 sm:pb-8 lg:pb-10">
              <h1 className="relative max-w-4xl text-[2.15rem] font-black uppercase italic leading-[0.9] tracking-tight text-white sm:pt-1 sm:text-5xl lg:text-7xl">
                <span className="inline-block">Fair Value</span>{' '}
                <span className="relative inline-block bg-gradient-to-r from-[#6f7dff] via-[#8f67ff] to-[#ec68c8] bg-clip-text text-transparent before:absolute before:inset-x-0 before:bottom-1 before:h-[0.18em] before:rounded-full before:bg-gradient-to-r before:from-[#6f7dff]/0 before:via-[#8f67ff]/60 before:to-[#ec68c8]/0 before:blur-md before:content-['']">Guarantee</span>
              </h1>
              <p className="relative mt-4 max-w-[13rem] text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300 sm:max-w-md sm:text-sm sm:tracking-[0.2em] lg:max-w-3xl lg:text-base lg:tracking-[0.22em]">
                Discover, open &amp; collect on Pullz
              </p>
            </div>

            <img
              src="/heroperson.png"
              alt="Pullz fair value guarantee hero"
              loading="lazy"
              decoding="async"
              className="pointer-events-none relative z-0 h-auto w-[98px] shrink-0 self-end object-contain sm:w-[132px] lg:absolute lg:bottom-0 lg:right-8 lg:w-[220px] xl:right-12 xl:w-[250px]"
            />
          </div>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-white/10 bg-[#0b0d13] shadow-[0_35px_70px_-50px_rgba(0,0,0,1)]">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 lg:px-7">
          <p className="pb-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            Best mystery boxes online
          </p>
          <div className="overflow-hidden rounded-[28px] border border-[#242a38] bg-[#090c13]">
            <div className="grid min-h-[240px] xl:grid-cols-[360px_minmax(0,1fr)]">
              <button
                type="button"
                onClick={() => showcaseBox && onOpenBox(showcaseBox.id)}
                className="relative flex min-h-[300px] flex-col items-center justify-end overflow-hidden border-b border-[#242a38] bg-[radial-gradient(circle_at_30%_20%,rgba(81,104,255,0.32),transparent_52%),radial-gradient(circle_at_72%_70%,rgba(249,134,36,0.22),transparent_62%),linear-gradient(180deg,#12192b_0%,#0a0d15_100%)] p-5 text-center sm:min-h-[320px] xl:min-h-[240px] xl:items-start xl:border-b-0 xl:border-r xl:text-left"
              >
                <div className="pointer-events-none absolute left-1/2 top-[150px] h-10 w-44 -translate-x-1/2 rounded-full bg-orange-400/45 blur-xl xl:left-[110px] xl:top-[118px] xl:w-36 xl:translate-x-0" />
                {showcaseBox && (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={showcaseBox.image}
                    alt={showcaseBox.name}
                    className="pointer-events-none absolute left-1/2 top-7 h-44 w-44 -translate-x-1/2 object-contain opacity-100 sm:h-52 sm:w-52 xl:left-7 xl:top-5 xl:h-36 xl:w-36 xl:translate-x-0"
                  />
                )}
                <p className="relative z-10 line-clamp-2 text-[42px] font-black uppercase italic leading-[0.88] tracking-tight text-white sm:text-[56px] xl:text-[40px]">
                  {showcaseBox?.name ?? 'Iphone 17 Series'}
                </p>
                <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] xl:justify-start">
                  <span className="rounded bg-[#5f64ff] px-2 py-1 text-white">New arrival</span>
                  <span className="text-gray-400">Sneakers</span>
                </div>
              </button>

              <div className="relative mx-auto flex h-[240px] w-full max-w-[1000px] items-center overflow-hidden rounded-2xl border border-white/5 bg-[rgba(255,255,255,0.02)] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-20 bg-gradient-to-r from-[#070b12] via-[#070b12]/85 to-transparent sm:w-28" />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-20 bg-gradient-to-l from-[#070b12] via-[#070b12]/85 to-transparent sm:w-28" />

                <div
                  ref={spinnerTrackRef}
                  className={`flex px-[50%] py-6 will-change-transform transition-transform ${isSpinAnimating ? 'duration-[5200ms] ease-[cubic-bezier(0.08,0.9,0.15,1)]' : 'duration-200 ease-out'}`}
                  style={{
                    gap: `${spinnerCardGap}px`,
                    marginLeft: `-${spinnerCardWidth / 2}px`,
                    transform: `translateX(-${demoSpinIndex * (spinnerCardWidth + spinnerCardGap)}px)`
                  }}
                >
                  {demoReelItems.map((item, idx) => {
                    const isLandedWinner = landedIndex === idx && !isSpinAnimating;
                    const isLegendary = String(item.rarity ?? '').toLowerCase() === 'legendary';
                    return (
                      <div
                        ref={idx === 0 ? spinnerCardRef : null}
                        key={`${item.id}-${idx}`}
                        className={`group relative flex h-[150px] w-[120px] flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[rgba(255,255,255,0.03)] p-2 transition-all duration-300 hover:border-cyan-200/35 hover:shadow-[0_0_18px_rgba(0,234,255,0.22)] sm:h-[210px] sm:w-[170px] sm:p-2.5 ${
                          isLandedWinner
                            ? 'border-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.34)]'
                            : ''
                        }`}
                        style={{
                          boxShadow: isLandedWinner
                            ? `${isLegendary ? '0 0 18px rgba(251,191,36,0.28), ' : ''}0 0 24px rgba(34,211,238,0.34)`
                            : (isLegendary ? '0 0 18px rgba(251,191,36,0.28)' : '0 8px 24px rgba(0,0,0,0.45)')
                        }}
                      >
                        <div
                          className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[999px] opacity-90 blur-xl sm:h-28 sm:w-24"
                          style={{
                            background: `${item.color}66`,
                            boxShadow: `0 0 38px ${item.color}88`
                          }}
                        ></div>
                        <img
                          loading="lazy"
                          decoding="async"
                          src={item.image}
                          alt={item.name}
                          className="relative z-10 h-[88px] w-[88px] object-contain sm:h-32 sm:w-32"
                        />
                        <div className="relative z-10 mt-2 flex items-center justify-center px-1 text-xs font-semibold text-emerald-100 sm:text-sm">
                          <CoinAmount
                            amount={item.price}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            className="text-emerald-100"
                            iconClassName="h-4 w-4"
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl opacity-60" style={{ backgroundColor: item.color }}></div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 z-[26] w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/80 to-transparent"
                  style={{ boxShadow: '0 0 14px rgba(0,234,255,0.55)' }}
                />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[24] w-14 -translate-x-1/2 bg-gradient-to-r from-cyan-400/0 via-cyan-300/20 to-cyan-400/0 sm:w-20" />
              </div>
            </div>

            <div className="flex items-center justify-center border-t border-[#242a38] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#59d189]">
              ● Live demo mode
            </div>
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
          Sign up now and get a <span className="text-[#6962ff]">free</span> mystery box!
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

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-y border-white/10 bg-[#0d0f16]">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-10 sm:px-5 sm:py-12 lg:px-7">
          <h2 className="text-center text-3xl font-black uppercase text-white sm:text-4xl">
            How it <span className="text-[#6962ff]">works</span>
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Pick a box', 'Choose a category you love'],
              ['02', 'Open it', 'Reveal your pull instantly'],
              ['03', 'Keep or trade', 'Ship items or convert to coins']
            ].map(([num, title, description], index) => {
              const stepImage = stripeSettings.howItWorksStepImageUrls[index]?.trim();
              return (
                <article
                  key={num}
                  className="rounded-2xl border border-white/10 bg-[#111520] p-6 text-center"
                >
                  {stepImage ? (
                    <img
                      src={stepImage}
                      alt={`Step ${index + 1}`}
                      className="mx-auto h-24 w-full max-w-[180px] rounded-xl object-cover sm:h-28 sm:max-w-[210px]"
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
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-y border-white/10 bg-[#0b0f17]">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-10 sm:px-5 sm:py-12 lg:px-7">
          <h2 className="text-center text-3xl font-black uppercase text-white sm:text-4xl">
            Frequently asked <span className="text-[#6962ff]">questions</span>
          </h2>
          <div className="mx-auto mt-5 w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0f141d]">
            {FAQ_ITEMS.map((item, index) => {
              const expanded = openFaq === index;
              return (
                <div key={item.question} className="border-b border-white/10 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(expanded ? -1 : index)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6"
                  >
                    <span className="text-sm font-bold text-white sm:text-base">{item.question}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <p className="px-4 pb-4 text-sm text-gray-300 sm:px-6 sm:pb-6">{item.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-y border-white/10 bg-[#0d0f16]">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-10 sm:px-5 sm:py-12 lg:px-7">
          <div className="rounded-2xl border border-white/10 bg-[#111520] p-6 sm:p-8">
            <h3 className="text-2xl font-black text-white">Mystery Boxes for Sale by Category</h3>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-gray-300">
              Pullz is an online mystery box website where you can buy mystery boxes across multiple categories, from
              tech and gaming setups to trading cards, collectibles, anime and more.
            </p>
            <ul className="mt-4 grid gap-2 pl-5 text-sm text-gray-300 marker:text-[#6962ff] md:grid-cols-2">
              <li className="list-disc">Trading cards, collector packs and rare sealed products.</li>
              <li className="list-disc">Gaming gear, phones, accessories and desk essentials.</li>
              <li className="list-disc md:col-span-2">Figures, lifestyle items and fan-favorite collectibles.</li>
            </ul>
            <button
              type="button"
              onClick={onViewAllBoxes}
              className="mt-6 w-full rounded-lg bg-[#5a55ff] px-8 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#6d68ff] sm:w-auto"
            >
              View all boxes
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
