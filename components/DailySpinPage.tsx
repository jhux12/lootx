import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, Crown, Gift, LockKeyhole, PackageOpen, Sparkles, Timer } from "lucide-react";
import { COIN_ICON } from "../constants";
import type { MysteryBox } from "../types";

interface DailySpinPageProps {
  onBack?: () => void;
  nextClaimAt: number;
  embedded?: boolean;
  dailyBox?: MysteryBox | null;
  hasMadeDeposit?: boolean;
  onOpenDailyBox?: () => void;
  depositMissionCents?: number;
  depositMissionCycleStart?: number;
  depositMissionClaims?: Record<string, number>;
  claimingMissionId?: string | null;
  onClaimDepositMission?: (missionId: string) => void;
}

const formatCountdown = (target: number) => {
  const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const milestones = [
  { id: "deposit_50", targetCents: 5000, amount: "$50", reward: "250 Coins", rewardCoins: 250 },
  { id: "deposit_250", targetCents: 25000, amount: "$250", reward: "1,000 Coins", rewardCoins: 1000 },
  { id: "deposit_500", targetCents: 50000, amount: "$500", reward: "2,500 Coins", rewardCoins: 2500 },
];

export const DailySpinPage: React.FC<DailySpinPageProps> = ({ onBack, nextClaimAt, embedded = false, dailyBox, hasMadeDeposit = false, onOpenDailyBox, depositMissionCents = 0, depositMissionCycleStart = 0, depositMissionClaims = {}, claimingMissionId, onClaimDepositMission }) => {
  const [now, setNow] = useState(Date.now());
  const [isOpeningDailyBox, setIsOpeningDailyBox] = useState(false);
  const effectiveNextClaimAt = nextClaimAt > 0 ? nextClaimAt : 0;
  const isDailyBoxReady = hasMadeDeposit && effectiveNextClaimAt <= now;
  const nextMission = milestones.find((mission) => depositMissionCents < mission.targetCents) ?? milestones[milestones.length - 1];
  const missionProgress = Math.min(100, Math.round((depositMissionCents / nextMission.targetCents) * 100));
  const missionResetAt = depositMissionCycleStart ? depositMissionCycleStart + 30 * 24 * 60 * 60 * 1000 : 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleOpenDailyBox = () => {
    if (!dailyBox || !isDailyBoxReady || isOpeningDailyBox || !onOpenDailyBox) return;
    setIsOpeningDailyBox(true);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onOpenDailyBox, prefersReducedMotion ? 120 : 900);
  };

  return (
    <main className={`${embedded ? "min-h-[700px]" : "min-h-[calc(100vh-70px)]"} relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050711] text-white`}>
      {isOpeningDailyBox && dailyBox && (
        <div className="fixed inset-0 z-[300] grid place-items-center overflow-hidden bg-[#04050b]/90 px-5 backdrop-blur-md" role="status" aria-live="polite">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,.35),transparent_45%)]" />
          <div className="daily-box-burst absolute h-72 w-72 rounded-full border border-violet-300/40 sm:h-[430px] sm:w-[430px]" />
          <div className="daily-box-burst absolute h-52 w-52 rounded-full border-2 border-blue-400/30 [animation-delay:120ms] sm:h-80 sm:w-80" />
          {[...Array(10)].map((_, index) => <Sparkles key={index} className="daily-box-spark absolute h-5 w-5 text-violet-300" style={{ transform: `rotate(${index * 36}deg) translateY(-clamp(120px,28vw,240px))`, animationDelay: `${index * 45}ms` }} />)}
          <div className="daily-box-launch relative flex flex-col items-center text-center">
            <div className="absolute inset-0 scale-125 rounded-full bg-violet-500/30 blur-3xl" />
            <img src={dailyBox.image} alt="" className="relative h-52 w-52 object-contain drop-shadow-[0_28px_45px_rgba(97,55,255,.7)] sm:h-80 sm:w-80" />
            <p className="relative mt-4 text-xs font-black uppercase tracking-[.3em] text-violet-300">Opening your daily box</p>
            <h2 className="relative mt-2 text-2xl font-black sm:text-4xl">{dailyBox.name}</h2>
          </div>
          <style>{`@keyframes dailyBoxLaunch{0%{opacity:0;transform:translateY(34vh) scale(.45) rotate(-8deg)}55%{opacity:1;transform:translateY(0) scale(1.12) rotate(2deg)}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes dailyBoxBurst{0%{opacity:0;transform:scale(.3)}70%{opacity:1}100%{opacity:0;transform:scale(1.35)}}@keyframes dailyBoxSpark{0%{opacity:0}45%{opacity:1}100%{opacity:0}}.daily-box-launch{animation:dailyBoxLaunch .82s cubic-bezier(.16,1,.3,1) both}.daily-box-burst{animation:dailyBoxBurst .9s ease-out both}.daily-box-spark{animation:dailyBoxSpark .75s ease-out both}@media(prefers-reduced-motion:reduce){.daily-box-launch,.daily-box-burst,.daily-box-spark{animation:none}}`}</style>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(111,42,255,.13),transparent_28rem),radial-gradient(circle_at_25%_65%,rgba(35,91,255,.09),transparent_30rem)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-10 lg:py-11">
        {onBack && <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><ChevronLeft className="h-5 w-5" /> Back</button>}

        <header className="mb-7 flex items-center justify-between lg:mb-9">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-950 shadow-[0_0_35px_rgba(139,62,255,.3)] ring-1 ring-violet-300/20 sm:h-16 sm:w-16"><Gift className="h-7 w-7 sm:h-8 sm:w-8" /></span>
            <div><h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">REWARDS</h1><p className="mt-1 text-sm text-slate-300 sm:text-base">Earn rewards the more you play.</p></div>
          </div>
          <button className="hidden rounded-xl border border-violet-400/20 bg-violet-950/40 px-4 py-2 text-sm font-semibold text-slate-200 sm:block">ⓘ &nbsp; How it works</button>
        </header>

        <section className="relative mb-8 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-[#141641] via-[#0d1230] to-[#160a2f] p-6 shadow-[0_20px_70px_rgba(0,0,0,.28)] sm:p-8 lg:p-10">
          <div className="absolute right-[-15px] top-[-5px] opacity-20 blur-3xl"><div className="h-52 w-52 rounded-full bg-violet-500" /></div>
          <div className="relative z-10 max-w-[70%] sm:max-w-[65%]"><p className="flex items-center gap-2 text-xs font-black sm:text-sm"><Sparkles className="h-4 w-4" /> 30-DAY DEPOSIT PROGRESS</p><p className="mt-3 text-4xl font-black text-violet-500 sm:text-6xl">${(depositMissionCents / 100).toFixed(0)} <span className="text-xl text-slate-300 sm:text-3xl">/ {nextMission.amount}</span></p><p className="mt-3 font-semibold text-slate-300"><span className="text-violet-400">${(Math.max(0, nextMission.targetCents - depositMissionCents) / 100).toFixed(0)}</span> until your next reward</p><p className="mt-2 flex items-center gap-2 font-bold"><img src={COIN_ICON} className="h-5 w-5" alt="" /> {nextMission.reward}</p></div>
          <div className="absolute right-4 top-10 sm:right-10"><div className="relative h-24 w-28 sm:h-36 sm:w-44"><img src={COIN_ICON} alt="Bonus coins" className="absolute bottom-0 right-2 h-20 w-20 drop-shadow-[0_0_22px_rgba(255,183,0,.45)] sm:h-32 sm:w-32" /><img src={COIN_ICON} alt="" className="absolute bottom-3 left-0 h-12 w-12 opacity-80 sm:h-20 sm:w-20" /></div></div>
          <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-slate-700/60 ring-1 ring-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-400 shadow-[0_0_16px_rgba(90,100,255,.7)]" style={{ width: `${missionProgress}%` }} /></div><p className="mt-1 text-right text-xs font-bold text-violet-400">{missionProgress}%</p>
        </section>

        <section className="mb-8"><div className="mb-5 flex flex-wrap items-baseline gap-3"><h2 className="flex items-center gap-2 text-base font-black sm:text-lg"><Crown className="h-5 w-5 text-yellow-400" /> DEPOSIT MISSIONS</h2><p className="text-xs text-slate-400">Progress resets every 30 days{missionResetAt > now ? ` · ${formatCountdown(missionResetAt)} remaining` : ""}.</p></div>
          <div className="grid gap-3 lg:grid-cols-3 lg:gap-8">{milestones.map((milestone, index) => { const ready = depositMissionCents >= milestone.targetCents; const claimed = depositMissionClaims[milestone.id] === depositMissionCycleStart; return <article key={milestone.id} className={`relative flex min-h-24 items-center rounded-xl border bg-gradient-to-br from-[#101629] to-[#090d17] p-4 lg:min-h-56 lg:flex-col lg:justify-center lg:text-center ${ready && !claimed ? "border-violet-500 shadow-[0_0_30px_rgba(124,58,237,.18)]" : "border-slate-700/60"}`}><span className="absolute left-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-slate-600 text-xs font-black lg:left-1/2 lg:top-[-12px] lg:-translate-x-1/2 lg:translate-y-0">{index + 1}</span><div className="ml-9 flex flex-1 items-center gap-3 lg:ml-0 lg:flex-col"><img src={COIN_ICON} alt="" className="h-11 w-11" /><div><p className="text-xl font-black text-violet-400">{milestone.amount}</p><p className="text-xs text-slate-300">Deposited this cycle</p></div></div><button type="button" disabled={!ready || claimed || claimingMissionId === milestone.id} onClick={() => onClaimDepositMission?.(milestone.id)} className={`rounded-full px-4 py-2 text-xs font-bold sm:text-sm ${ready && !claimed ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-violet-900/50 text-slate-400"}`}>{claimed ? "Claimed" : claimingMissionId === milestone.id ? "Claiming..." : ready ? `Claim ${milestone.reward}` : milestone.reward}</button>{!ready && <LockKeyhole className="absolute right-2 top-2 h-4 w-4 text-slate-500" />}</article>; })}</div>
          <p className="mt-4 text-xs text-slate-500 lg:text-center">Only completed, verified deposits count. Rewards must be claimed before the 30-day cycle resets.</p>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-[#11163a] to-[#090d20] p-5 sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black sm:text-xl"><PackageOpen className="h-5 w-5 text-violet-300" /> DAILY FREE BOX</h2>{hasMadeDeposit ? <p className="mt-1 text-xs text-slate-300 sm:text-sm">One free mystery box every 24 hours.</p> : <div className="relative mt-2 inline-flex items-center overflow-hidden rounded-lg border border-white/10 bg-black/20 px-3 py-2"><p className="select-none text-xs text-slate-300 blur-[4px] sm:text-sm">Make your first deposit to unlock one free mystery box every 24 hours.</p><span className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-bold text-slate-100"><LockKeyhole className="h-4 w-4 text-violet-300" /> Locked until first deposit</span></div>}</div>{hasMadeDeposit && <span className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs"><Timer className="h-4 w-4" /> {isDailyBoxReady ? "Ready to open" : `Resets in ${formatCountdown(effectiveNextClaimAt)}`}</span>}</div>
          <div className="mx-auto mt-7 grid max-w-3xl items-center gap-6 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-[minmax(180px,280px)_1fr] sm:p-7">
            <div className="relative mx-auto grid aspect-square w-full max-w-[250px] place-items-center overflow-hidden rounded-2xl bg-[radial-gradient(circle,rgba(124,58,237,.34),transparent_65%)]"><div className="absolute inset-4 rounded-full bg-violet-500/10 blur-2xl" />{dailyBox?.image ? <img src={dailyBox.image} alt={dailyBox.name} className="relative h-full w-full object-contain p-4 drop-shadow-[0_22px_32px_rgba(0,0,0,.5)]" /> : <Gift className="relative h-24 w-24 text-violet-400" />}{!hasMadeDeposit && <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#080b14]"><LockKeyhole className="h-5 w-5 text-slate-400" /></span>}</div>
            <div className="text-center sm:text-left"><p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">Today&apos;s free reward</p><h3 className="mt-2 text-2xl font-black sm:text-3xl">{dailyBox?.name ?? "Daily Mystery Box"}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{!hasMadeDeposit ? "Your daily box activates automatically after your first successful deposit." : isDailyBoxReady ? "Your free box is ready. Open it as a full box opening and reveal exactly what you won." : "You claimed today’s box. Come back when the timer reaches zero for another free opening."}</p><button type="button" onClick={handleOpenDailyBox} disabled={!dailyBox || !isDailyBoxReady || isOpeningDailyBox} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3 text-sm font-black shadow-[0_12px_30px_rgba(90,67,255,.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none sm:w-auto">{!hasMadeDeposit ? <><LockKeyhole className="h-4 w-4" /> UNLOCK AFTER FIRST DEPOSIT</> : !dailyBox ? "DAILY BOX COMING SOON" : isOpeningDailyBox ? "OPENING..." : isDailyBoxReady ? <><PackageOpen className="h-4 w-4" /> OPEN &amp; REVEAL</> : <><CheckCircle2 className="h-4 w-4" /> CLAIMED TODAY</>}</button></div>
          </div>
        </section>
      </div>
    </main>
  );
};
