import React, { useMemo } from 'react';
import { MysteryBox } from '../types';
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

const rarityGlowClass: Record<string, string> = {
  legendary: 'bg-amber-300/35',
  epic: 'bg-fuchsia-400/30',
  rare: 'bg-cyan-300/28',
  uncommon: 'bg-emerald-300/24',
  common: 'bg-slate-300/18'
};

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const { setView } = useGame();
  const featuredBoxes = boxes.slice(0, 5);
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
            {[
              {
                title: 'Open your first box',
                image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/open.png?alt=media&token=34515af9-0309-412b-95fe-fb22837fd060'
              },
              {
                title: 'Upgrade your items',
                image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/upgrade.png?alt=media&token=41935126-5d8f-4430-ae63-e6e47713e793'
              },
              {
                title: 'Climb Leaderboards',
                image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/leader.png?alt=media&token=d1904a5a-5b16-4b67-b23d-4b307dc72136'
              }
            ].map((tile, index) => (
              <button
                key={`${tile.title}-${index}`}
                type="button"
                onClick={() => {
                  if (index === 0) onViewAllBoxes();
                  if (index === 1) setView({ type: 'PLINKO' });
                  if (index === 2) setView({ type: 'LEADERBOARD' });
                }}
                className="group relative min-h-[160px] overflow-hidden rounded-xl border border-white/5 bg-[#21282c] p-4 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_12px_28px_rgba(5,8,12,0.45)] focus-visible:-translate-y-1 focus-visible:border-slate-400/35 sm:min-h-[150px] lg:min-h-[156px]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_60%,rgba(34,211,238,0.20),transparent_52%),radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
                <p className="relative z-10 max-w-[140px] text-sm font-black uppercase leading-5 text-slate-100">{tile.title}</p>
                <img
                  src={tile.image}
                  alt={`${tile.title} artwork`}
                  className="pointer-events-none absolute right-1 bottom-0 z-10 h-[128px] w-[128px] shrink-0 object-contain opacity-100 transition-transform duration-300 ease-out group-hover:scale-105 sm:h-[124px] sm:w-[124px] md:h-[132px] md:w-[132px] lg:h-[138px] lg:w-[138px]"
                  loading="lazy"
                  width={500}
                  height={500}
                />
              </button>
            ))}
          </div>

          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><span className="text-slate-400">▣</span>Available Boxes</h2>
              <button onClick={onViewAllBoxes} className="px-1 py-2 text-xs font-bold text-white/90 hover:text-white">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-5">
              {featuredBoxes.map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="group rounded-xl border border-transparent bg-transparent p-2 text-center transition-colors duration-300 ease-out">
                  <div className="flex h-[145px] items-center justify-center p-2 sm:h-[170px]">
                    <img src={box.image} alt={box.name} className="max-h-full w-auto object-contain transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-[-3deg]" loading="lazy" />
                  </div>
                  <div className="mt-2 flex justify-center">
                    <CoinAmount amount={Math.round(box.price)} className="text-sm font-semibold text-slate-200" iconClassName="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-black">Top Upgrades</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {topUpgrades.map((upgrade) => (
                <div key={upgrade.id} className="group rounded-xl border border-white/5 bg-[#22282c] p-3 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_10px_24px_rgba(5,8,12,0.42)]">
                  <p className="text-xs font-black text-yellow-300">{upgrade.multiplier}</p>
                  <div className="my-3 flex h-[80px] items-center justify-center">
                    <img src={upgrade.image} alt={upgrade.name} className="max-h-full max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105 group-hover:rotate-[-1deg]" loading="lazy" />
                  </div>
                  <p className="truncate text-xs text-slate-400">{upgrade.name}</p>
                  <CoinAmount amount={Math.round(upgrade.price)} className="mt-1 text-sm font-black text-white" iconClassName="h-4 w-4" />
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
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />
                  <div className="relative z-10 flex min-h-[185px] flex-col items-center justify-center gap-3 transition-transform duration-500 ease-out group-hover:translate-y-[120%] group-focus-within:translate-y-[120%] sm:min-h-[210px]">
                    <div className="relative flex h-40 w-full items-center justify-center sm:h-48">
                      <div className={`pointer-events-none absolute inset-x-8 top-8 bottom-8 rounded-[40%] blur-3xl opacity-70 ${rarityGlowClass[item.rarity] ?? rarityGlowClass.common}`} />
                      <img src={item.itemImage} alt={item.itemName} className="relative z-10 max-h-32 max-w-[85%] object-contain drop-shadow-2xl sm:max-h-40" loading="lazy" />
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
