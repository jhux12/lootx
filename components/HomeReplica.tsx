import React from 'react';
import { MysteryBox } from '../types';

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

const topOpens = [
  ['Cadillac Escalade-V', '$200,000.00', '🏎️'],
  ['Ferrari Anniversary', '$100,000.00', '⌚'],
  ['Rolex Daytona White', '$86,350.00', '⌚']
];

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const featuredBoxes = boxes.slice(0, 5);

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
              <h2 className="text-xl font-black">New Boxes</h2>
              <button onClick={onViewAllBoxes} className="rounded-md border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/10">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {featuredBoxes.map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="overflow-hidden rounded-xl border border-white/10 bg-[#22282c] text-left hover:border-cyan-300/60">
                  <div className="flex h-[170px] items-center justify-center bg-gradient-to-br from-cyan-600/30 to-purple-700/30 p-2">
                    <img src={box.image} alt={box.name} className="max-h-full w-auto object-contain" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-black">{box.name}</p>
                    <p className="mt-1 text-xs text-slate-300">{Math.round(box.price)} coins</p>
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
            <h3 className="mb-3 text-sm font-black uppercase text-slate-300">Top Opens</h3>
            <div className="space-y-3">
              {topOpens.map((item) => (
                <div key={item[0]} className="rounded-xl bg-[#22282c] p-3 text-center">
                  <div className="text-3xl">{item[2]}</div>
                  <p className="mt-2 truncate text-xs text-slate-300">{item[0]}</p>
                  <p className="text-sm font-black">{item[1]}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};
