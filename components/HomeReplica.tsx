import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  'What is PackDraw?',
  'How do I open a pack?',
  'How do I deposit?',
  'Missing crypto deposit?',
  'What are Battles?',
  'How do I get Support?'
];

const deals = [
  { title: '1999 Ultra Platinum M...', mult: '1.85x', price: '$43,750.00' },
  { title: 'David Yurman Pyr...', mult: '9.26x', price: '$21,600.00' },
  { title: 'Bulgari Serpenti Vi...', mult: '2.07x', price: '$21,720.00' },
  { title: 'Bulgari Serpenti Vi...', mult: '1.54x', price: '$21,720.00' }
];

const side = [
  '$200,000.00', '$100,000.00', '$86,350.00', '$95.00', '$1.00', '$10.00', '$6.50', '$10.00'
];

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, isChatCollapsed, onOpenBox }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const cards = useMemo(() => boxes.slice(0, 10), [boxes]);

  return (
    <div className={`mx-auto w-full px-3 pb-12 pt-4 sm:px-5 lg:px-6 ${isChatCollapsed ? 'max-w-[1410px]' : 'max-w-[1320px]'}`}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_292px]">
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {['YOUR FIRST BATTLE WIN', 'OPEN YOUR FIRST PACK!', 'YOUR BEST DEAL'].map((t, i) => (
              <article key={t} className="relative min-h-[118px] overflow-hidden rounded-xl border border-white/10 bg-[#1a2433] p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a2537] via-[#182131] to-[#121a27]" />
                <div className="absolute -right-3 top-0 h-28 w-28 rounded-full blur-2xl" style={{ background: i === 0 ? 'rgba(255,185,72,0.45)' : i === 1 ? 'rgba(88,93,255,0.38)' : 'rgba(132,193,255,0.35)' }} />
                <p className="relative z-10 mt-8 max-w-[140px] text-sm font-extrabold leading-4 text-white">{t}</p>
              </article>
            ))}
          </section>

          <section className="rounded-xl border border-white/5 bg-[#141d2b] p-3 sm:p-4">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-[30px] font-semibold leading-none text-white sm:text-[32px]">New Packs</h2>
              <button className="text-sm text-white/70">View All</button>
            </header>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {cards.slice(0, 5).map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="text-center">
                  <div className="overflow-hidden rounded-[10px] bg-[#212e43]">
                    <img src={box.image} alt={box.name} className="h-44 w-full object-cover sm:h-64" />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-white"><CoinAmount amount={box.price ?? 0} /></p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-[34px] font-semibold text-white">Battle Highlights</h3><button className="text-sm text-white/70">View All</button></div>
            {[1,2,3].map((row) => (
              <div key={row} className="flex flex-col gap-3 rounded-xl bg-[#182332] p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2 text-white/80">NORMAL MODE</div>
                  <div className="h-16 rounded-lg bg-[#0f1725]" />
                </div>
                <div className="w-full md:w-[210px]"><p className="mb-2 text-white/70">unboxed: $32,365.35</p><button className="w-full rounded-lg bg-[#2a3444] py-2 font-semibold text-white">View Results</button></div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-[34px] font-semibold text-white">Deal Highlights</h3><button className="text-sm text-white/70">View All</button></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {deals.map((d) => (
                <div key={d.title+d.mult} className="rounded-lg bg-[#182333] p-3">
                  <p className="text-sm font-bold text-yellow-300">{d.mult}</p>
                  <div className="my-2 h-20 rounded bg-[#101827]" />
                  <p className="truncate text-sm text-white/70">{d.title}</p>
                  <p className="text-2xl font-semibold text-white">{d.price}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-xl bg-[#141d2b] p-4">
            <h3 className="text-[34px] font-semibold text-white">How It Works</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {['01. Open Packs', '02. Win Items', '03. Cash or Claim'].map((t) => (
                <article key={t} className="rounded-xl bg-[#1b2638] p-4 text-center">
                  <div className="mb-3 h-28 rounded-lg bg-[#263651]" />
                  <p className="text-2xl font-semibold text-white">{t}</p>
                  <p className="mt-1 text-sm text-white/60">Find your perfect packs & experience the online excitement!</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {faqs.map((q, idx) => {
              const open = openFaq === idx;
              return (
                <div key={q} className="rounded-lg bg-[#1a2433]">
                  <button onClick={() => setOpenFaq(open ? null : idx)} className="flex w-full items-center justify-between px-4 py-4 text-left text-white"><span className="font-semibold">{q}</span><ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} /></button>
                  {open && <p className="px-4 pb-4 text-sm text-white/70">Support articles and guides are available for this topic.</p>}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="space-y-3">
            <h3 className="text-[30px] font-semibold text-white">Top Opens</h3>
            {side.map((price, i) => (
              <div key={price+i} className="rounded-xl bg-[#172232] p-3">
                <div className="h-24 rounded-md bg-[#101828]" />
                <p className="mt-2 text-sm text-white/70">Item name</p>
                <p className="text-3xl font-semibold text-white">{price}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
