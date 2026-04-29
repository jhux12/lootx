import React, { useMemo } from 'react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

const faqs = [
  'What is Pullz.gg?',
  'How do I deposit?',
  'Is Pullz.gg fair and safe?',
  'Missing crypto deposit?',
  'How do I open a box?',
  'How do Battles work?',
  'How do I cash out or ship?',
  'How can I contact support?'
];

const deals = [
  ['1.85x', '1999 Ultra Platinu...', '$43,750.00', '🃏'],
  ['9.26x', 'David Yurman Pyr...', '$21,600.00', '💍'],
  ['1.60x', '1999 Ultra Platinu...', '$43,750.00', '🃏'],
  ['4.00x', 'Rolex Datejust Whi...', '$20,000.00', '⌚'],
  ['2.07x', 'Bulgari Serpenti Vl...', '$21,720.00', '💍'],
  ['1.45x', 'Bulgari Serpenti Vl...', '$21,720.00', '💍']
];

const rarityGlowClass: Record<string, string> = {
  legendary: 'from-amber-300/30 via-yellow-300/10 to-transparent shadow-[0_0_45px_rgba(250,204,21,0.25)]',
  epic: 'from-fuchsia-400/25 via-purple-400/10 to-transparent shadow-[0_0_40px_rgba(192,132,252,0.24)]',
  rare: 'from-cyan-300/25 via-sky-300/10 to-transparent shadow-[0_0_35px_rgba(56,189,248,0.22)]',
  uncommon: 'from-emerald-300/25 via-green-300/10 to-transparent shadow-[0_0_30px_rgba(74,222,128,0.2)]',
  common: 'from-slate-300/15 via-slate-300/5 to-transparent shadow-[0_0_20px_rgba(148,163,184,0.14)]'
};

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const featuredBoxes = boxes.slice(0, 5);
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
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto grid max-w-[1250px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_240px]">
        <section className="min-w-0 space-y-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {['Your first battle win', 'Open your first box', 'Your best deal'].map((title) => (
              <div key={title} className="relative min-h-[110px] rounded-xl bg-[#21282c] p-4">
                <p className="max-w-[140px] text-sm font-black uppercase leading-5 text-slate-100">{title}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><span className="text-slate-400">▣</span>Available Boxes</h2>
              <button onClick={onViewAllBoxes} className="px-1 py-2 text-xs font-bold text-white/90 hover:text-white">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-5">
              {featuredBoxes.map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="text-center">
                  <div className="flex h-[170px] items-center justify-center p-2">
                    <img src={box.image} alt={box.name} className="max-h-full w-auto object-contain" loading="lazy" />
                  </div>
                  <div className="mt-2 flex justify-center">
                    <CoinAmount amount={Math.round(box.price)} className="text-sm font-semibold text-slate-200" iconClassName="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-black">Deal Highlights</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {deals.map((deal) => (
                <div key={`${deal[0]}-${deal[1]}`} className="rounded-xl bg-[#22282c] p-3">
                  <p className="text-xs font-black text-yellow-300">{deal[0]}</p>
                  <div className="my-3 text-center text-4xl">{deal[3]}</div>
                  <p className="truncate text-xs text-slate-400">{deal[1]}</p>
                  <p className="text-sm font-black">{deal[2]}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#22282c] p-5">
            <h2 className="text-xl font-black">Get started with Pullz.gg</h2>
            <p className="mt-2 text-sm text-slate-300">Sign up and open your first box in seconds.</p>
            <button onClick={onSignUp} className="mt-4 w-full rounded-lg bg-[#2b96dc] px-4 py-3 text-sm font-black sm:w-auto">Create Account</button>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {faqs.map((question) => (
              <button key={question} className="flex items-center justify-between rounded-xl bg-[#22282c] px-4 py-4 text-left text-sm font-bold">
                {question}
                <span className="text-slate-400">⌄</span>
              </button>
            ))}
          </section>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:block">
          <section>
            <h3 className="mb-3 text-sm font-black uppercase text-slate-300">Top Pullz</h3>
            <div className="space-y-3">
              {topPullz.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-2xl bg-[#1f2730] p-3 text-center sm:p-4">
                  <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_58%)] ${rarityGlowClass[item.rarity] ?? rarityGlowClass.common}`} />
                  <div className="relative z-10 flex min-h-[185px] flex-col items-center justify-center gap-3 transition-transform duration-500 ease-out group-hover:translate-y-[120%] group-focus-within:translate-y-[120%] sm:min-h-[210px]">
                    <div className={`grid h-24 w-24 place-items-center rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent_68%)] sm:h-28 sm:w-28 ${rarityGlowClass[item.rarity] ?? rarityGlowClass.common}`}>
                      <img src={item.itemImage} alt={item.itemName} className="h-20 w-20 object-contain sm:h-24 sm:w-24" loading="lazy" />
                    </div>
                    <p className="max-w-[180px] truncate text-sm text-slate-300 sm:max-w-[200px]">{item.itemName}</p>
                    <CoinAmount amount={Math.round(item.itemPrice)} className="justify-center text-xl font-black text-white" iconClassName="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="absolute inset-0 z-20 grid translate-y-[125%] place-items-center opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-hover:-translate-y-1 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <img src={item.boxImage} alt={item.boxName} className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28" loading="lazy" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};
