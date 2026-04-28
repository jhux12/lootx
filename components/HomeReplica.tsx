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

const normalizeRarity = (rarity?: string) => {
  const value = String(rarity ?? 'common').toLowerCase();
  if (value.includes('legend')) return 'legendary';
  if (value.includes('epic')) return 'epic';
  if (value.includes('rare')) return 'rare';
  if (value.includes('uncommon')) return 'uncommon';
  return 'common';
};

export const HomeReplica: React.FC<HomeReplicaProps> = ({
  boxes,
  demoBoxId,
  isChatCollapsed,
  onOpenBox,
  onViewAllBoxes,
  onSignUp
}) => {
  const { stripeSettings, setView, isAuthenticated } = useGame();
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
  const SPINNER_CARD_GAP = 2;
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

    @keyframes fairValuePulse {
      0%, 100% { opacity: 0.6; transform: scale(0.98); }
      50% { opacity: 1; transform: scale(1.04); }
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
      <section className="relative w-full min-h-[44vh] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b14] shadow-[0_35px_70px_-50px_rgba(0,0,0,1)] sm:min-h-[47vh] lg:min-h-[48vh]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_90%_at_16%_24%,rgba(52,102,255,0.28)_0%,rgba(52,102,255,0.08)_42%,transparent_74%),radial-gradient(130%_95%_at_82%_28%,rgba(212,74,255,0.24)_0%,rgba(136,72,255,0.08)_46%,transparent_76%),radial-gradient(90%_70%_at_52%_42%,rgba(78,137,255,0.12)_0%,transparent_70%),linear-gradient(125deg,#070b16_0%,#0b1120_46%,#070b14_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(58deg,rgba(123,139,255,0.07)_0,rgba(123,139,255,0.07)_1px,transparent_1px,transparent_34px),repeating-linear-gradient(-58deg,rgba(236,104,200,0.07)_0,rgba(236,104,200,0.07)_1px,transparent_1px,transparent_34px)] opacity-20 sm:opacity-24" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(3,6,12,0.66)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative mx-auto w-full px-4 pb-1 pt-4 text-left sm:px-6 sm:pb-2 sm:pt-[18px] lg:px-8 lg:pb-1 lg:pt-4">
          <div className="relative z-10 grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-center">
            <div className="flex min-w-0 flex-col items-start lg:pr-4">
              <div className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-[#5f72b4] bg-[#11182f]/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.19em] text-slate-100 shadow-[0_0_22px_rgba(94,92,230,0.36)] backdrop-blur-md sm:text-[11px]">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#4f86ff] to-[#d34dd8] text-white">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" aria-hidden>
                    <path d="M12 3l7 3v5c0 4.4-2.98 8.5-7 9.5-4.02-1-7-5.1-7-9.5V6l7-3z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </span>
                <span>Provably Fair</span>
                <span className="pointer-events-none absolute inset-y-0 w-[38%] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[fairValueShimmer_3.4s_ease-in-out_infinite]" />
              </div>

              <h1 className="relative mt-3 max-w-4xl text-[2.55rem] font-black uppercase italic leading-[0.85] tracking-tight text-white sm:mt-3.5 sm:text-[3.7rem] lg:mt-4 lg:text-[4.75rem]">
                <span className="inline-block">Open Mystery</span>{' '}
                <span className="relative inline-block bg-gradient-to-r from-[#6f93ff] via-[#9a73ff] to-[#ff59dc] bg-clip-text text-transparent [text-shadow:0_0_20px_rgba(167,139,250,0.35)]">Boxes</span>
              </h1>
              <p className="relative mt-2.5 max-w-md text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:mt-3 sm:text-sm lg:mt-3.5 lg:text-[15px]">
                Win real sneakers, tech, collectibles &amp; more
              </p>
              <div className="mt-3 flex max-w-full items-center gap-x-4 gap-y-1 overflow-hidden whitespace-nowrap text-[11px] font-medium text-slate-300 sm:mt-3.5 sm:text-sm lg:mt-4">
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />Provably Fair</span>
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />Real Items</span>
                <span className="hidden items-center gap-2 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />Instant Payouts</span>
              </div>
              <div className="mt-4 flex w-full flex-col gap-2.5 sm:mt-[18px] sm:w-auto sm:flex-row lg:mt-5">
                <button
                  type="button"
                  onClick={isAuthenticated ? onViewAllBoxes : onSignUp}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#4f67ff] via-[#7a57ff] to-[#cc42d4] px-8 py-3 text-sm font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_16px_46px_-18px_rgba(124,58,237,0.94)] transition duration-300 hover:scale-[1.03] hover:brightness-110 hover:shadow-[0_24px_58px_-18px_rgba(124,58,237,0.98)]"
                >
                  {isAuthenticated ? 'Open Boxes' : 'Sign Up & Get Free Box'}
                </button>
                <button
                  type="button"
                  onClick={onViewAllBoxes}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-[#090d19]/70 px-6 text-sm font-semibold uppercase tracking-[0.1em] text-slate-100 transition hover:border-violet-300/50 hover:bg-white/10"
                >
                  Learn More
                </button>
              </div>
            </div>

            <div className="relative -mb-1 flex min-h-[185px] items-end justify-center pt-0 sm:min-h-[240px] lg:min-h-[300px] lg:justify-end">
              <div className="pointer-events-none absolute bottom-[8%] h-[260px] w-[300px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(52,203,255,0.45)_0%,rgba(148,65,246,0.28)_44%,transparent_78%)] blur-[46px] animate-[fairValuePulse_9s_ease-in-out_infinite] sm:h-[320px] sm:w-[390px] sm:bg-[radial-gradient(ellipse_at_center,rgba(52,203,255,0.56)_0%,rgba(148,65,246,0.34)_42%,transparent_78%)] lg:bottom-[7%] lg:h-[440px] lg:w-[560px]" />
              <div className="pointer-events-none absolute bottom-[13%] h-[170px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(121,76,255,0.3)_0%,rgba(33,189,255,0.22)_48%,transparent_76%)] blur-[36px] sm:h-[220px] sm:w-[280px] lg:h-[320px] lg:w-[380px]" />
              <div className="pointer-events-none absolute bottom-[4%] h-[110px] w-[68%] rounded-full bg-cyan-300/25 blur-2xl" />
              <img
                src="/heroperson.png"
                alt="Pullz fair value guarantee hero"
                loading="lazy"
                decoding="async"
                className="pointer-events-none relative z-10 block h-auto w-[230px] max-w-full object-contain drop-shadow-[0_0_26px_rgba(56,189,248,0.52)] sm:w-[310px] lg:w-[400px] xl:w-[460px]"
                style={{ filter: 'contrast(1.1) saturate(1.16) drop-shadow(0 0 36px rgba(99,102,241,0.56)) drop-shadow(0 0 78px rgba(236,72,153,0.36))' }}
              />
              <div className="pointer-events-none absolute inset-y-[20%] right-[16%] hidden w-[14%] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.0),rgba(175,219,255,0.5),rgba(255,255,255,0.0))] opacity-55 blur-md sm:block" />
            </div>
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
                  <span className="text-gray-400">Pokemon</span>
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
                    const rarity = normalizeRarity(item.rarity);
                    const rarityGlow =
                      rarity === 'legendary'
                        ? 'rgba(255,191,71,0.58)'
                        : rarity === 'epic'
                          ? 'rgba(196,125,255,0.52)'
                          : rarity === 'rare'
                            ? 'rgba(96,165,250,0.48)'
                            : rarity === 'uncommon'
                              ? 'rgba(74,222,128,0.42)'
                              : 'rgba(100,116,139,0.35)';
                    return (
                      <div
                        ref={idx === 0 ? spinnerCardRef : null}
                        key={`${item.id}-${idx}`}
                        className={`group relative flex h-[168px] w-[132px] flex-shrink-0 flex-col items-center justify-between overflow-hidden rounded-[18px] border border-[#2b3961]/85 bg-[radial-gradient(circle_at_50%_35%,rgba(33,52,94,0.34),rgba(8,14,30,0.96)_62%)] px-2 pb-2.5 pt-2 transition-all duration-300 hover:border-cyan-200/40 sm:h-[210px] sm:w-[170px] sm:px-2.5 sm:pb-3 sm:pt-2.5 ${
                          isLandedWinner
                            ? 'border-[#f5c34a] shadow-[0_0_26px_rgba(245,195,74,0.32)]'
                            : ''
                        }`}
                        style={{
                          boxShadow: isLandedWinner
                            ? `0 0 0 1px rgba(245,195,74,0.42), 0 0 30px ${rarityGlow}, inset 0 0 0 1px rgba(255,255,255,0.12)`
                            : `0 0 18px ${rarityGlow}, inset 0 0 0 1px rgba(255,255,255,0.06)`
                        }}
                      >
                        <div
                          className="pointer-events-none absolute left-1/2 top-[44%] h-20 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[999px] opacity-90 blur-xl sm:h-28 sm:w-24"
                          style={{
                            background: `${item.color}66`,
                            boxShadow: `0 0 38px ${item.color}88`
                          }}
                        ></div>
                        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center self-stretch pt-2 sm:pt-3">
                          <img
                            loading="lazy"
                            decoding="async"
                            src={item.image}
                            alt={item.name}
                            className="h-[108px] w-[108px] translate-y-1 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] sm:h-[132px] sm:w-[132px] sm:translate-y-1.5"
                          />
                        </div>
                        <div className="relative z-10 mt-1 flex items-center justify-center px-1 text-[13px] font-extrabold leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.7)] sm:text-[16px]">
                          <CoinAmount
                            amount={item.price}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            className="text-white"
                            iconClassName="h-[11px] w-[11px] sm:h-[13px] sm:w-[13px]"
                            animated={false}
                          />
                        </div>
                        <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px opacity-55" style={{ backgroundColor: item.color }}></div>
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
