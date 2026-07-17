import React, { useMemo } from 'react';
import { ArrowRight, Box, PackageCheck, ShieldCheck, Sparkles, Trophy, Truck, Zap } from 'lucide-react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
  trendingBoxIds?: string[];
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

const fallbackCards = [
  { title: 'Premium Pulls', price: 25, accent: 'from-[#262b34] to-[#171b20]' },
  { title: 'Collector Heat', price: 50, accent: 'from-[#2f2738] to-[#171b20]' },
  { title: 'Daily Starter', price: 5, accent: 'from-[#223234] to-[#171b20]' }
];

const valueHighlights = [
  { label: 'Open Boxes', detail: 'Choose a pack and reveal one real prize.', icon: Box },
  { label: 'Win Items', detail: 'Keep your pull or sell back instantly.', icon: Trophy },
  { label: 'Ship Wins', detail: 'Build a cart and send hits to your door.', icon: Truck }
];

const trustHighlights = [
  { label: 'Provably fair', icon: ShieldCheck },
  { label: 'Fast sellback', icon: Zap },
  { label: 'Real prizes', icon: PackageCheck }
];

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, trendingBoxIds = [], onOpenBox, onViewAllBoxes, onSignUp }) => {
  const featuredBoxes = useMemo(() => {
    const pinned = trendingBoxIds
      .map((id) => boxes.find((box) => box.id === id))
      .filter(Boolean) as MysteryBox[];
    return (pinned.length ? pinned : boxes).slice(0, 6);
  }, [boxes, trendingBoxIds]);

  const heroBox = featuredBoxes[0] ?? boxes[0];

  return (
    <div className="min-h-screen bg-[#171b20] text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 pb-24 pt-3 sm:gap-6 sm:px-6 sm:pb-14 sm:pt-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#20252c] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_10%,rgba(93,247,177,0.18),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]" />
          <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#5df7b1]/30 bg-[#5df7b1]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-[#5df7b1]">
                <Sparkles className="h-3.5 w-3.5" /> Minimal mystery boxes
              </div>
              <h1 className="mt-5 text-balance text-4xl font-black uppercase leading-[0.92] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                Open boxes. Win real collectibles.
              </h1>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
                A cleaner, darker homepage inspired by PackDraw's simple pack-first layout: bold cards, neon green accents, and quick paths to open, sell back, or ship your wins.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onViewAllBoxes} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#5df7b1] px-6 text-sm font-black uppercase tracking-wide text-[#12161b] shadow-[0_12px_34px_rgba(93,247,177,0.26)] transition hover:bg-[#7ffac4] active:scale-[0.98]">
                  Open boxes <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={onSignUp} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/5 px-6 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/10 active:scale-[0.98]">
                  Register free
                </button>
              </div>
            </div>

            <button type="button" onClick={() => heroBox ? onOpenBox(heroBox.id) : onViewAllBoxes()} className="group relative min-h-[320px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#171b20] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.32)] transition hover:-translate-y-1 active:scale-[0.99] sm:min-h-[400px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(93,247,177,0.20),transparent_34%),linear-gradient(180deg,transparent_46%,rgba(0,0,0,0.58))]" />
              {heroBox?.image ? <img src={heroBox.image} alt="" className="relative z-10 mx-auto h-56 w-full object-contain drop-shadow-[0_26px_30px_rgba(0,0,0,0.46)] transition duration-300 group-hover:scale-105 sm:h-72" loading="eager" decoding="async" /> : <div className="relative z-10 grid h-56 place-items-center rounded-3xl bg-white/5 text-6xl sm:h-72">🎁</div>}
              <div className="absolute inset-x-5 bottom-5 z-20 rounded-2xl border border-white/10 bg-[#20252c]/90 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5df7b1]">Featured pack</p>
                    <h2 className="mt-1 truncate text-2xl font-black uppercase tracking-tight text-white">{heroBox?.name || 'Mystery Box'}</h2>
                  </div>
                  {heroBox ? <CoinAmount amount={Math.round(heroBox.price)} className="shrink-0 text-lg font-black text-[#5df7b1]" iconClassName="h-5 w-5" animated={false} /> : null}
                </div>
              </div>
            </button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {trustHighlights.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#20252c] p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5df7b1]/10 text-[#5df7b1]"><Icon className="h-5 w-5" /></span>
              <span className="text-sm font-black uppercase tracking-wide text-slate-100">{label}</span>
            </div>
          ))}
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-[#20252c] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5df7b1]">New packs</p>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">Start opening</h2>
            </div>
            <button type="button" onClick={onViewAllBoxes} className="rounded-full bg-white/8 px-4 py-2 text-xs font-black uppercase text-slate-200 hover:bg-white/12">View all</button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(featuredBoxes.length ? featuredBoxes : fallbackCards).slice(0, 6).map((box, index) => {
              const realBox = 'id' in box ? box : null;
              return (
                <button key={realBox?.id ?? box.title} type="button" onClick={() => realBox ? onOpenBox(realBox.id) : onViewAllBoxes()} className="group relative min-h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#171b20] p-4 text-left transition hover:-translate-y-1 active:scale-[0.99]">
                  <div className={`absolute inset-0 bg-gradient-to-br ${realBox ? 'from-[#262b34] to-[#171b20]' : box.accent}`} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(93,247,177,0.13),transparent_38%),linear-gradient(180deg,transparent_44%,rgba(0,0,0,0.54))]" />
                  {realBox?.image ? <img src={realBox.image} alt="" className="relative z-10 mx-auto h-36 w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.42)] transition duration-300 group-hover:scale-105" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" /> : <div className="relative z-10 grid h-36 place-items-center text-5xl">🎁</div>}
                  <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl bg-black/22 px-3 py-2 backdrop-blur">
                    <span className="min-w-0 truncate text-sm font-black uppercase text-white">{realBox?.name ?? box.title}</span>
                    <CoinAmount amount={Math.round(realBox?.price ?? box.price)} className="shrink-0 text-sm font-black text-[#5df7b1]" iconClassName="h-4 w-4" animated={false} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 pb-4 sm:grid-cols-3">
          {valueHighlights.map(({ label, detail, icon: Icon }, index) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-[#20252c] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-black text-[#5df7b1]">0{index + 1}</span>
                <Icon className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="text-lg font-black uppercase text-white">{label}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{detail}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};
