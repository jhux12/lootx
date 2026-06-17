import React from 'react';
import { Box, CalendarClock, Check, ChevronRight, Crown, Lock, PackageOpen, Sparkles, WalletCards } from 'lucide-react';

const PULL_PASS_HERO_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/pullpass%2FUntitled%20design.png?alt=media&token=71332ff4-61eb-483a-8bcc-33eb8a2e58d4';

type RewardStatus = 'claimed' | 'active' | 'locked';

const currentTier = 12;

const rewards: Array<{ tier: number; name: string; status: RewardStatus; type: 'coins' | 'box' | 'xp' }> = [
  { tier: 9, name: '100 Coins', status: 'claimed', type: 'coins' },
  { tier: 10, name: 'Silver Box', status: 'claimed', type: 'box' },
  { tier: 11, name: '250 XP', status: 'claimed', type: 'xp' },
  { tier: 12, name: 'Silver Box', status: 'active', type: 'box' },
  { tier: 13, name: '150 Coins', status: 'locked', type: 'coins' },
  { tier: 14, name: 'Gold Box', status: 'locked', type: 'box' },
  { tier: 15, name: '300 XP', status: 'locked', type: 'xp' },
  { tier: 20, name: '500 Coins', status: 'locked', type: 'coins' },
  { tier: 50, name: 'Collector Box', status: 'locked', type: 'box' },
];

const activeRewardIndex = rewards.findIndex((reward) => reward.tier === currentTier);
const timelineProgress = `${(activeRewardIndex / Math.max(rewards.length - 1, 1)) * 100}%`;

const missions = [
  { icon: PackageOpen, title: 'Open Cases', description: 'Open any case', progress: '0 / 5', xp: '250 XP', fill: '0%' },
  { icon: CalendarClock, title: 'Daily Login', description: 'Login to the site', progress: '1 / 1', xp: '+5 XP', fill: '100%', complete: true },
  { icon: Box, title: 'Ship An Item', description: 'Ship any item', progress: '0 / 1', xp: '25 XP', fill: '0%' },
  { icon: WalletCards, title: 'Make A Deposit', description: 'Deposit any amount', progress: '0 / 1', xp: '50 XP', fill: '0%' },
];

const MiniRewardArt: React.FC<{ type: 'coins' | 'box' | 'xp'; compact?: boolean }> = ({ type, compact }) => {
  if (type === 'coins') {
    return (
      <div className={`relative ${compact ? 'h-12 w-16' : 'h-20 w-24'}`} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((coin) => (
          <span
            key={coin}
            className="absolute h-3.5 w-8 rounded-full border border-amber-200/70 bg-[linear-gradient(180deg,#ffe68a,#f5a800)] shadow-[0_3px_10px_rgba(245,168,0,0.22)]"
            style={{ left: `${(coin % 3) * 18}px`, bottom: `${Math.floor(coin / 2) * 9 + (coin % 2) * 4}px` }}
          />
        ))}
      </div>
    );
  }

  if (type === 'xp') {
    return (
      <div className={`${compact ? 'h-12 w-12' : 'h-20 w-20'} grid place-items-center rounded-2xl border border-purple-300/40 bg-purple-500/15 shadow-[0_0_26px_rgba(124,58,237,0.25)]`} aria-hidden="true">
        <span className="text-lg font-black text-purple-200">XP</span>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'h-12 w-16' : 'h-20 w-24'} relative grid place-items-center`} aria-hidden="true">
      <div className="h-9 w-14 -skew-x-6 rounded-md border border-sky-200/35 bg-[linear-gradient(145deg,#d8ecff_0%,#356086_42%,#071225_100%)] shadow-[0_0_22px_rgba(111,168,255,0.22)] sm:h-11 sm:w-16">
        <div className="mx-auto mt-2 h-3 w-8 rounded bg-[#091323]/70 text-center text-[6px] font-black leading-3 text-white">PULLZ</div>
      </div>
    </div>
  );
};

const PullPassIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-11 w-11 sm:h-12 sm:w-12" aria-hidden="true">
    <path d="M32 4L55 17V47L32 60L9 47V17L32 4Z" fill="#111827" stroke="#7C3AED" strokeWidth="3" />
    <path d="M32 9L50 19.5V44.5L32 55L14 44.5V19.5L32 9Z" fill="url(#pull-pass-icon-gradient)" stroke="#A855F7" strokeWidth="1.5" />
    <path d="M32 17L36.2 26.1L46 27.2L38.7 33.8L40.7 43.5L32 38.5L23.3 43.5L25.3 33.8L18 27.2L27.8 26.1L32 17Z" fill="#FACC15" stroke="#FEF3C7" strokeWidth="1.5" />
    <path d="M32 17L36.2 26.1L46 27.2L38.7 33.8L40.7 43.5L32 38.5V17Z" fill="#F59E0B" opacity="0.65" />
    <defs>
      <linearGradient id="pull-pass-icon-gradient" x1="32" y1="9" x2="32" y2="55" gradientUnits="userSpaceOnUse">
        <stop stopColor="#312E81" />
        <stop offset="1" stopColor="#09090B" />
      </linearGradient>
    </defs>
  </svg>
);

const PullPassHeroArt = () => (
  <div className="relative mx-auto h-[210px] w-full max-w-[360px] lg:h-[330px] lg:max-w-[520px]" aria-hidden="true">
    <div className="absolute inset-x-8 bottom-2 top-8 rounded-full bg-purple-600/25 blur-3xl" />
    {[0, 1, 2, 3].map((card) => (
      <div
        key={card}
        className="absolute h-24 w-16 rounded-lg border border-purple-200/15 bg-[linear-gradient(145deg,rgba(107,33,168,0.4),rgba(9,9,11,0.92))] shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
        style={{
          left: `${card * 21 + 16}%`,
          top: `${card % 2 ? 16 : 40}px`,
          transform: `rotate(${[-18, -8, 12, 22][card]}deg)`,
        }}
      >
        <div className="m-2 h-10 rounded-md bg-purple-400/10" />
        <Sparkles className="mx-auto h-5 w-5 text-purple-200/60" />
      </div>
    ))}
    <img
      src={PULL_PASS_HERO_IMAGE}
      alt="Pull Pass mystery box"
      className="absolute bottom-1 left-1/2 h-[170px] w-[270px] -translate-x-1/2 object-contain drop-shadow-[0_24px_58px_rgba(88,28,135,0.45)] lg:bottom-0 lg:h-[280px] lg:w-[440px]"
      loading="eager"
      decoding="async"
    />
  </div>
);

export const PullPassPage: React.FC = () => (
  <div className="min-h-screen overflow-x-hidden bg-[#09090B] px-4 py-6 text-white sm:py-8 lg:px-8 lg:py-12">
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 sm:gap-5 lg:gap-8">
      <section className="grid items-center gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1fr)] lg:gap-10">
        <div className="relative z-10 pt-2 lg:pt-0">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-purple-300/30 bg-purple-500/10 shadow-[0_0_24px_rgba(124,58,237,0.18)] sm:h-14 sm:w-14">
              <PullPassIcon />
            </div>
            <h1 className="text-[42px] font-black italic leading-none tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">PULL PASS</h1>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-base font-extrabold text-white/90 sm:text-lg">Level up, Earn Rewards.</p>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-purple-400/30 bg-purple-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-purple-200"><ClockDot />LIVE NOW</span>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-400 sm:text-base">Earn XP by opening boxes and completing missions to unlock exclusive rewards.</p>
        </div>
        <PullPassHeroArt />
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b1220]/86 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:ml-auto lg:w-[720px] lg:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-white">TIER <span className="text-purple-300">12</span> <span className="text-slate-500">/ 50</span></h2>
          <button className="inline-flex items-center gap-1 text-xs font-extrabold uppercase text-purple-300 transition-colors hover:text-purple-100">View All Tiers <ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-[62%] rounded-full bg-[linear-gradient(90deg,#7c3aed,#9333ea)] shadow-[0_0_18px_rgba(147,51,234,0.45)]" /></div>
        <p className="mt-2 text-xs font-semibold text-slate-300">620 / 1000 XP</p>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/7 bg-white/[0.03] p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Next Reward</p>
            <p className="text-base font-bold text-white">Silver Box</p>
            <p className="text-xs font-semibold text-slate-400">80 XP away</p>
          </div>
          <div className="flex items-center gap-2"><MiniRewardArt type="box" compact /><ChevronRight className="h-5 w-5 text-slate-500" /></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid grid-cols-2 border-b border-white/10 text-xs font-extrabold uppercase"><button className="border-b-2 border-purple-500 py-4 text-purple-200">Rewards</button><button className="py-4 text-slate-400">XP Missions</button></div>
        <div className="px-3 py-4 sm:px-5">
          <div className="mb-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Pull Pass tier timeline">
            <div className="relative flex min-w-max gap-2.5 px-1 pt-3 sm:gap-3">
              <div className="absolute left-[47px] right-[47px] top-[46px] h-2 overflow-hidden rounded-full bg-slate-800/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:left-[55px] sm:right-[55px]" aria-hidden="true">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#9333ea)] shadow-[0_0_14px_rgba(147,51,234,0.5)]" style={{ width: timelineProgress }} />
              </div>
              {rewards.map((reward) => (
                <div key={reward.tier} className="relative z-10 flex w-[92px] shrink-0 flex-col items-center sm:w-[108px]">
                  <p className={`mb-2 text-[11px] font-black leading-none ${reward.status === 'active' ? 'text-purple-200' : 'text-white'}`}>{reward.tier}</p>
                  <div className={`grid place-items-center rounded-full border-2 transition-all duration-200 ${reward.status === 'active' ? 'h-8 w-8 border-purple-200 bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.7)]' : reward.status === 'claimed' ? 'h-5 w-5 border-purple-300 bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'h-5 w-5 border-slate-700 bg-[#09090B]'}`}>
                    {reward.status === 'claimed' ? <Check className="h-3.5 w-3.5" /> : reward.status === 'active' ? <span className="text-[10px] font-black">{reward.tier}</span> : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
                  </div>
                  <div className={`mt-3 w-full rounded-xl border px-2 py-2 text-center ${reward.status === 'active' ? 'border-purple-400/80 bg-purple-500/15' : 'border-white/10 bg-white/[0.03]'}`}>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tier {reward.tier}</p>
                    <p className="truncate text-xs font-bold text-white">{reward.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Pull Pass rewards">
            <div className="flex min-w-max gap-2.5 sm:gap-3">
              {rewards.map((reward) => (
                <article key={reward.tier} className={`group flex h-[220px] w-[160px] flex-col rounded-2xl border p-3 transition duration-200 hover:-translate-y-1 ${reward.status === 'active' ? 'border-purple-400 bg-purple-500/10 shadow-[0_0_22px_rgba(147,51,234,0.22)]' : 'border-white/10 bg-white/[0.035]'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">Tier <span className="text-white">{reward.tier}</span></p>
                    {reward.status === 'claimed' ? <Check className="h-4 w-4 text-emerald-400" /> : reward.status === 'locked' ? <Lock className="h-4 w-4 text-slate-500" /> : <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-black text-white">Active</span>}
                  </div>
                  <div className="grid flex-1 place-items-center"><MiniRewardArt type={reward.type} /></div>
                  <h3 className="text-center text-sm font-bold text-white">{reward.name}</h3>
                  <div className="mt-3 grid h-5 place-items-center text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {reward.status === 'claimed' ? 'Claimed' : reward.status === 'locked' ? 'Locked' : 'Current Tier'}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4"><Crown className="h-10 w-10 shrink-0 text-amber-300" /><div className="min-w-0 flex-1"><h3 className="text-sm font-black uppercase text-amber-200">Upgrade To Premium</h3><p className="text-xs text-slate-400">Unlock premium rewards and future season content.</p></div><button disabled className="rounded-lg bg-[linear-gradient(135deg,#7c3aed,#4c1d95)] px-5 py-3 text-xs font-black text-white opacity-75">COMING SOON</button></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b1220]/86 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-black uppercase">XP Missions</h2><button className="text-xs font-extrabold uppercase text-purple-300">View All</button></div>
        <div className="space-y-2">
          {missions.map((mission) => <div key={mission.title} className="flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.035] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-500/10"><mission.icon className="h-5 w-5 text-purple-200" /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-white">{mission.title}</h3><p className="text-xs text-slate-400">{mission.description}</p></div><span className={`w-12 text-right text-xs font-bold ${mission.complete ? 'text-emerald-400' : 'text-slate-300'}`}>{mission.progress}</span><div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-800 sm:block"><div className="h-full rounded-full bg-emerald-500" style={{ width: mission.fill }} /></div><span className={`w-14 text-right text-xs font-bold ${mission.complete ? 'text-emerald-400' : 'text-white'}`}>{mission.xp}</span><ChevronRight className="h-4 w-4 text-slate-500" /></div>)}
        </div>
      </section>
    </div>
  </div>
);

const ClockDot = () => <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.85)]" aria-hidden="true" />;

export default PullPassPage;
