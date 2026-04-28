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

type FaqItem = { question: string; answer: string };

const FAQ_ITEMS: FaqItem[] = [
  { question: 'What is PackDraw?', answer: 'PackDraw is an online pack opening experience where you can open packs, win items, and either keep or cash out your rewards.' },
  { question: 'How do I open a pack?', answer: 'Choose any pack, click it, and confirm the opening. Your result appears immediately with full transparency.' },
  { question: 'How do I deposit?', answer: 'Use the top-up flow and pick your preferred payment method to add balance to your account.' },
  { question: 'Missing crypto deposit?', answer: 'Blockchain confirmation times vary. If it does not arrive, contact support with your transaction hash.' },
  { question: 'What are Battles?', answer: 'Battles are head-to-head openings where players compete based on the value of their pulls.' },
  { question: 'How do I get Support?', answer: 'Contact support anytime at support@packdraw.com for payment, account, or item help.' }
];

const sidebarRows = [
  { label: 'Cadillac Escalade-V', value: '$200,000.00' },
  { label: 'Techframe Ferrari', value: '$100,000.00' },
  { label: 'Rolex Daytona', value: '$86,350.00' },
  { label: 'Coach Contrast Trim', value: '$95.00' },
  { label: 'Mirror', value: '$1.00' }
];

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, isChatCollapsed, onOpenBox }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const cards = useMemo(() => boxes.slice(0, 6), [boxes]);

  return (
    <div className={`mx-auto w-full px-3 pb-14 pt-4 sm:px-5 ${isChatCollapsed ? 'max-w-[1340px]' : 'max-w-[1260px]'}`}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px]">
        <main className="space-y-5">
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {['YOUR FIRST BATTLE WIN', 'OPEN YOUR FIRST PACK!', 'YOUR BEST DEAL'].map((copy, i) => (
              <div key={copy} className="relative min-h-[108px] overflow-hidden rounded-xl border border-white/10 bg-[#141d2a] p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-[#1e2a3d] via-[#1b2435] to-[#121a28]" />
                <div className="relative z-10 mt-8 max-w-[140px] text-sm font-extrabold leading-4 text-white/90">{copy}</div>
                <div className={`absolute right-2 top-1 h-24 w-24 rounded-full blur-md ${i === 0 ? 'bg-amber-400/45' : i === 1 ? 'bg-violet-400/40' : 'bg-sky-400/35'}`} />
              </div>
            ))}
          </section>

          <section className="rounded-xl bg-[#141d2a] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">New Packs</h2>
              <button className="text-sm text-white/70">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="text-left">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a2231]">
                    <img src={box.image} alt={box.name} className="h-44 w-full object-cover sm:h-56" />
                  </div>
                  <div className="pt-2 text-center text-base font-semibold text-white">
                    <CoinAmount amount={box.price ?? 0} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#141d2a] p-4">
            <h3 className="mb-4 text-2xl font-semibold text-white">How It Works</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {['01. Open Packs', '02. Win Items', '03. Cash or Claim'].map((title, index) => (
                <div key={title} className="rounded-xl border border-white/10 bg-[#1b2536] p-4 text-center">
                  <div className={`mx-auto mb-3 h-24 w-full rounded-lg ${index === 0 ? 'bg-sky-500/20' : index === 1 ? 'bg-indigo-500/20' : 'bg-cyan-400/20'}`} />
                  <h4 className="font-bold text-white">{title}</h4>
                  <p className="mt-1 text-sm text-white/60">Find your perfect packs and experience the thrill on any screen.</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2">
            {FAQ_ITEMS.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.question} className="overflow-hidden rounded-lg border border-white/10 bg-[#141d2a]">
                  <button onClick={() => setOpenFaq(open ? null : index)} className="flex w-full items-center justify-between px-4 py-3 text-left text-white">
                    <span className="font-semibold">{item.question}</span>
                    <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="px-4 pb-4 text-sm text-white/65">{item.answer}</p>}
                </div>
              );
            })}
          </section>
        </main>

        <aside className="hidden rounded-xl bg-[#101825] p-3 lg:block">
          <h3 className="mb-3 text-lg font-semibold text-white">Top Opens</h3>
          <div className="space-y-3">
            {sidebarRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-white/5 bg-[#182333] p-3">
                <div className="h-16 rounded-md bg-gradient-to-br from-[#202d40] to-[#111a28]" />
                <p className="mt-2 truncate text-sm text-white/70">{row.label}</p>
                <p className="text-xl font-bold text-white">{row.value}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
