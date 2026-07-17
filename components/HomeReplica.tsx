import React, { useMemo } from 'react';
import { ArrowRight, Box, Flame, PackageCheck, ShieldCheck, Sparkles, Trophy, Truck, Zap } from 'lucide-react';
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
  const heroBoxes = featuredBoxes.length ? featuredBoxes.slice(0, 4) : boxes.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#171b20] text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 pb-24 pt-3 sm:gap-6 sm:px-6 sm:pb-14 sm:pt-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,#4f26ef_0%,#557cf2_55%,#54e7b1_130%)] shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:rounded-[2rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.26),transparent_27%),radial-gradient(circle_at_80%_100%,rgba(93,247,177,0.26),transparent_34%),linear-gradient(90deg,rgba(13,17,23,0.10),rgba(13,17,23,0.36))]" />
          <div className="absolute -right-20 top-1/2 hidden -translate-y-1/2 gap-3 opacity-95 sm:flex lg:right-8" aria-hidden="true">
            {(heroBoxes.length ? heroBoxes : fallbackCards).map((box, index) => {
              const realBox = 'id' in box ? box : null;
              return (
                <div key={realBox?.id ?? box.title} className="grid h-36 w-24 rotate-[-5deg] place-items-center rounded-[1.25rem] border border-white/10 bg-black/12 p-2 shadow-[0_24px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm first:translate-y-4 even:rotate-[5deg] even:translate-y-[-10px] lg:h-48 lg:w-32">
                  {realBox?.image ? <img src={realBox.image} alt="" className="h-full w-full object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.38)]" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" /> : <span className="text-center text-xs font-black uppercase text-white/90">{box.title}</span>}
                </div>
              );
            })}
          </div>
          <div className="relative grid min-h-[260px] gap-5 p-5 sm:min-h-[310px] sm:p-7 lg:min-h-[360px] lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.6fr)] lg:items-center lg:p-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/22 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] backdrop-blur">
                <Flame className="h-3.5 w-3.5 text-[#5df7b1]" /> Trending now
              </div>
              <h1 className="mt-4 max-w-[680px] text-balance text-[2.7rem] font-black uppercase leading-[0.88] tracking-[-0.07em] text-white drop-shadow-[0_12px_24px_rgba(0,0,0,0.24)] sm:text-6xl lg:text-7xl">
                Open the boxes everyone is watching.
              </h1>
              <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-white/82 sm:text-base lg:text-lg">
                A modern, minimal hero with the old Pullz banner energy: big gradient color, floating packs, and instant mobile-friendly actions.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onViewAllBoxes} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#5df7b1] px-6 text-sm font-black uppercase tracking-wide text-[#11161c] shadow-[0_14px_34px_rgba(37,244,159,0.32)] transition hover:bg-[#80fac5] active:scale-[0.98]">
                  Browse boxes <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={onSignUp} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/18 bg-white/12 px-6 text-sm font-black uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/18 active:scale-[0.98]">
                  Create account
                </button>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:hidden" aria-hidden="true">
                {(heroBoxes.length ? heroBoxes : fallbackCards).slice(0, 3).map((box, index) => {
                  const realBox = 'id' in box ? box : null;
                  return (
                    <div key={realBox?.id ?? box.title} className="grid h-24 min-w-[76px] place-items-center rounded-2xl border border-white/10 bg-black/16 p-2 backdrop-blur">
                      {realBox?.image ? <img src={realBox.image} alt="" className="h-full w-full object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.35)]" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" /> : <span className="text-center text-[9px] font-black uppercase text-white/90">{box.title}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <button type="button" onClick={() => heroBox ? onOpenBox(heroBox.id) : onViewAllBoxes()} className="group relative overflow-hidden rounded-[1.35rem] border border-white/14 bg-[#12161d]/72 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_18px_42px_rgba(0,0,0,0.26)] backdrop-blur-md transition hover:-translate-y-1 active:scale-[0.99] sm:hidden lg:block">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(93,247,177,0.20),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.20))]" />
              {heroBox?.image ? <img src={heroBox.image} alt="" className="relative z-10 mx-auto h-40 w-full object-contain drop-shadow-[0_22px_26px_rgba(0,0,0,0.42)] transition duration-300 group-hover:scale-105 lg:h-56" loading="eager" decoding="async" /> : <div className="relative z-10 grid h-40 place-items-center rounded-3xl bg-white/5 text-6xl lg:h-56">🎁</div>}
              <div className="relative z-20 mt-3 rounded-2xl border border-white/10 bg-black/18 p-3 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5df7b1]">Featured box</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate text-xl font-black uppercase tracking-tight text-white">{heroBox?.name || 'Mystery Box'}</h2>
                  {heroBox ? <CoinAmount amount={Math.round(heroBox.price)} className="shrink-0 text-base font-black text-[#5df7b1]" iconClassName="h-4 w-4" animated={false} /> : null}
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
