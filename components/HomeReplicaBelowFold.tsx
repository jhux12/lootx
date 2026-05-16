import React, { useEffect, useMemo, useState } from 'react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';

type HomeReplicaBelowFoldProps = {
  boxes: MysteryBox[];
  showSignupCta: boolean;
  onSignUp: () => void;
};

const faqs = [
  {
    id: 'what-is-pullz',
    question: 'What is Pullz.gg?',
    answer: 'Pullz.gg is a social unboxing game where you open virtual boxes, collect item skins, and use coins to play modes like upgrades and battles.'
  },
  {
    id: 'how-to-deposit',
    question: 'How do I deposit?',
    answer: 'Sign in, open the Top Up page, choose a coin package, and complete checkout. Your coins are added automatically once payment is confirmed.'
  },
  {
    id: 'fair-and-safe',
    question: 'Is Pullz.gg fair and safe?',
    answer: 'Yes. Pullz.gg uses provably fair systems so outcomes can be verified. Always protect your account with a strong password and secure email.'
  },
  {
    id: 'open-box',
    question: 'How do I open a box?',
    answer: 'Browse Available Boxes, pick one you like, and press Open. The result is revealed instantly and the item appears in your inventory.'
  },
  {
    id: 'cash-out-ship',
    question: 'How do I cash out or ship?',
    answer: 'Open your inventory/profile and choose withdraw or shipping options when eligible. Requirements can depend on account and regional rules.'
  },
  {
    id: 'contact-support',
    question: 'How can I contact support?',
    answer: 'Use the support/contact option in the app and include your username plus relevant transaction details so the team can help faster.'
  }
];

type LiveWinItem = {
  id: string;
  name: string;
  image: string;
  price: number;
  rarity: string;
  boxName: string;
};

type LiveWin = LiveWinItem & {
  feedId: string;
  time: string;
};

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const liveWinRarityWeights: Record<Rarity, number> = {
  common: 42,
  uncommon: 30,
  rare: 20,
  epic: 6,
  legendary: 2
};

const rarityImageBorderClass: Record<string, string> = {
  legendary: 'border border-amber-300/40 shadow-[0_0_18px_rgba(252,211,77,0.10)]',
  epic: 'border border-purple-300/35 shadow-[0_0_18px_rgba(168,85,247,0.09)]',
  rare: 'border border-blue-300/30 shadow-[0_0_16px_rgba(96,165,250,0.08)]',
  uncommon: 'border border-emerald-300/25 shadow-[0_0_14px_rgba(52,211,153,0.07)]',
  common: ''
};

const randomFrom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const normalizeRarity = (rarity: string): Rarity => {
  const normalized = rarity.toLowerCase();
  if (normalized === 'legendary' || normalized === 'epic' || normalized === 'rare' || normalized === 'uncommon') return normalized;
  return 'common';
};

const getWeightedLiveWinItem = (items: LiveWinItem[]): LiveWinItem | null => {
  if (!items.length) return null;

  const itemsByRarity = items.reduce<Record<Rarity, LiveWinItem[]>>((groups, item) => {
    groups[normalizeRarity(item.rarity)].push(item);
    return groups;
  }, { common: [], uncommon: [], rare: [], epic: [], legendary: [] });
  const availableRarities = (Object.keys(liveWinRarityWeights) as Rarity[]).filter((rarity) => itemsByRarity[rarity].length > 0);
  if (!availableRarities.length) return randomFrom(items);

  const totalWeight = availableRarities.reduce((sum, rarity) => sum + liveWinRarityWeights[rarity], 0);
  let targetWeight = Math.random() * totalWeight;

  for (const rarity of availableRarities) {
    targetWeight -= liveWinRarityWeights[rarity];
    if (targetWeight <= 0) return randomFrom(itemsByRarity[rarity]);
  }

  const fallbackRarity = availableRarities[0];
  return fallbackRarity ? randomFrom(itemsByRarity[fallbackRarity]) : randomFrom(items);
};

const preloadLiveWinImage = (win: LiveWin): Promise<LiveWin> => {
  if (typeof window === 'undefined') return Promise.resolve(win);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(win);
    image.onerror = () => resolve(win);
    image.src = win.image;
  });
};

const createLiveWin = (items: LiveWinItem[], index = 0): LiveWin | null => {
  const item = getWeightedLiveWinItem(items);
  if (!item) return null;

  const minutesAgo = Math.floor(Math.random() * 9) + 1;

  return {
    ...item,
    feedId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    time: `${minutesAgo}m ago`
  };
};

const rarityGlowClass: Record<string, string> = {
  legendary: 'bg-amber-300/35',
  epic: 'bg-fuchsia-400/30',
  rare: 'bg-cyan-300/28',
  uncommon: 'bg-emerald-300/24',
  common: 'bg-slate-300/18'
};

export const HomeReplicaBelowFold: React.FC<HomeReplicaBelowFoldProps> = ({ boxes, showSignupCta, onSignUp }) => {
  const [openFaqId, setOpenFaqId] = useState<string | null>(faqs[0]?.id ?? null);
  const liveWinItems = useMemo<LiveWinItem[]>(() => {
    return boxes.flatMap((box) =>
      box.items.map((item) => ({
        id: `${box.id}-${item.id}`,
        name: item.name,
        image: item.image,
        price: item.price,
        rarity: item.rarity,
        boxName: box.name
      }))
    );
  }, [boxes]);
  const [liveWins, setLiveWins] = useState<LiveWin[]>([]);
  const topUpgrades = useMemo(() => {
    const highValueItems = boxes
      .flatMap((box) => box.items.map((item) => ({ ...item, boxId: box.id })))
      .sort((a, b) => b.price - a.price)
      .slice(0, 24);

    return [...highValueItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        multiplier: `${(1.2 + Math.random() * 8.8).toFixed(2)}x`
      }));
  }, [boxes]);
  useEffect(() => {
    let isMounted = true;
    let isLoadingNextWin = false;
    const initialWins = Array.from({ length: 6 }, (_, index) => createLiveWin(liveWinItems, index)).filter((win): win is LiveWin => Boolean(win));

    void Promise.all(initialWins.map(preloadLiveWinImage)).then((preloadedWins) => {
      if (isMounted) setLiveWins(preloadedWins);
    });

    if (!liveWinItems.length) {
      return () => {
        isMounted = false;
      };
    }

    const timer = window.setInterval(() => {
      if (isLoadingNextWin) return;
      const nextWin = createLiveWin(liveWinItems);
      if (!nextWin) return;

      isLoadingNextWin = true;
      void preloadLiveWinImage(nextWin).then((preloadedWin) => {
        isLoadingNextWin = false;
        if (!isMounted) return;
        setLiveWins((current) => [preloadedWin, ...current].slice(0, 7));
      });
    }, 2800);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [liveWinItems]);

  const topPullz = useMemo(() => {
    return boxes
      .flatMap((box) =>
        box.items.map((item) => ({
          id: `${box.id}-${item.id}`,
          itemName: item.name,
          itemImage: item.image,
          itemPrice: item.price,
          rarity: item.rarity,
          boxImage: box.image,
          boxName: box.name
        }))
      )
      .sort((a, b) => b.itemPrice - a.itemPrice)
      .slice(0, 3);
  }, [boxes]);

  return (
    <>
      <div className="space-y-10 lg:col-start-1">
        {liveWins.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#22282c] shadow-[0_18px_42px_rgba(5,8,12,0.24)]">
            <div className="border-b border-white/5 bg-[radial-gradient(circle_at_82%_10%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_18%_0%,rgba(168,85,247,0.18),transparent_30%)] p-3 sm:p-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                Live wins
              </div>
            </div>

            <div className="grid gap-2 p-3 sm:p-4">
              {liveWins.map((win, index) => (
                <div
                  key={win.feedId}
                  className="live-win-row group flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-[#1b2024]/80 p-3 transition-all duration-300 ease-out hover:border-cyan-300/20 hover:bg-[#252d32]"
                  style={{ animationDelay: `${Math.min(index, 5) * 35}ms` }}
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#252d32] transition-colors duration-300 sm:h-16 sm:w-16 ${rarityImageBorderClass[normalizeRarity(win.rarity)]}`}>
                    <img src={win.image} alt={win.name} className="max-h-full max-w-full object-contain p-1 transition-transform duration-300 ease-out group-hover:scale-105" loading="eager" decoding="async" width={96} height={96} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 truncate text-sm font-black text-white sm:text-base">{win.name}</p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
                      <span>{win.time}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-600" />
                      <span>{win.rarity}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-600" />
                      <span className="max-w-[120px] truncate normal-case tracking-normal text-slate-500 sm:max-w-[200px]">{win.boxName}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center rounded-full border border-yellow-300/15 bg-yellow-300/10 px-2.5 py-1.5 sm:px-3">
                      <CoinAmount amount={Math.round(win.price)} className="text-xs font-black text-white sm:text-sm" iconClassName="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <style>{`@keyframes liveWinRowIn{0%{opacity:0;transform:translate3d(0,-10px,0) scale(.985)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}.live-win-row{animation:liveWinRowIn 360ms cubic-bezier(.22,1,.36,1) both;will-change:transform,opacity}@media (prefers-reduced-motion: reduce){.live-win-row{animation:none;will-change:auto}}`}</style>

        <section>
          <h2 className="mb-4 text-xl font-black">Top Upgrades</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {topUpgrades.map((upgrade) => (
              <div key={upgrade.id} className="group min-h-[156px] rounded-xl border border-white/5 bg-[#22282c] p-3 transition-colors duration-200 ease-out hover:border-slate-400/35">
                <p className="text-xs font-black text-yellow-300">{upgrade.multiplier}</p>
                <div className="my-3 flex h-[80px] items-center justify-center">
                  <img src={upgrade.image} alt={upgrade.name} className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out group-hover:scale-105" loading="lazy" decoding="async" width={160} height={160} />
                </div>
                <p className="truncate text-xs text-slate-400">{upgrade.name}</p>
                <CoinAmount amount={Math.round(upgrade.price)} className="mt-1 text-sm font-black text-white" iconClassName="h-4 w-4" />
              </div>
            ))}
          </div>
        </section>

        {showSignupCta && (
          <section className="min-h-[150px] rounded-xl bg-[#22282c] p-5">
            <h2 className="text-xl font-black">Get started with Pullz.gg</h2>
            <p className="mt-2 text-sm text-slate-300">Sign up and open mystery boxes in seconds.</p>
            <button
              onClick={onSignUp}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(139,92,246,0.35)] transition-all duration-200 hover:brightness-110 sm:w-auto"
            >
              Create Account
            </button>
          </section>
        )}

        <section className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openFaqId === faq.id;
            return (
              <div key={faq.id} className="overflow-hidden rounded-xl bg-[#22282c]">
                <button
                  type="button"
                  onClick={() => setOpenFaqId((prev) => (prev === faq.id ? null : faq.id))}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-bold sm:text-base"
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                {isOpen && <p className="border-t border-white/10 px-4 py-4 text-sm leading-6 text-slate-300">{faq.answer}</p>}
              </div>
            );
          })}
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <section>
          <h3 className="mb-3 text-sm font-black uppercase text-slate-300">Top Pullz</h3>
          <div className="space-y-3">
            {topPullz.map((item) => (
              <div key={item.id} className="group relative min-h-[245px] overflow-hidden rounded-2xl bg-[#1f2730] p-3 text-center sm:p-4">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />
                <div className="relative z-10 flex min-h-[185px] flex-col items-center justify-center gap-3 transition-transform duration-300 ease-out group-hover:translate-y-[120%] group-focus-within:translate-y-[120%] sm:min-h-[210px]">
                  <div className="relative flex h-52 w-full items-center justify-center sm:h-56">
                    <div className={`pointer-events-none absolute inset-x-8 top-8 bottom-8 rounded-[40%] blur-2xl opacity-60 ${rarityGlowClass[item.rarity] ?? rarityGlowClass.common}`} />
                    <img src={item.itemImage} alt={item.itemName} className="relative z-10 max-h-44 max-w-[92%] object-contain drop-shadow-xl sm:max-h-48" loading="lazy" decoding="async" width={220} height={220} />
                  </div>
                  <p className="max-w-[180px] truncate text-sm text-slate-300 sm:max-w-[200px]">{item.itemName}</p>
                  <CoinAmount amount={Math.round(item.itemPrice)} className="justify-center text-xl font-black text-white" iconClassName="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="absolute inset-0 z-20 grid translate-y-[125%] place-items-center opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <img src={item.boxImage} alt={item.boxName} className="h-32 w-32 rounded-xl object-cover sm:h-36 sm:w-36" loading="lazy" decoding="async" width={144} height={144} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </>
  );
};
