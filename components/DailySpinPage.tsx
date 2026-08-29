import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Box, Check, ChevronLeft, Gift, Lock, Sparkles } from "lucide-react";
import { COIN_ICON } from "../constants";

type RewardTier = { name: string; spendRequired: number; rewardCoins: number };
interface DailySpinPageProps {
  onBack?: () => void;
  onClaim: () => Promise<{ amount: number; nextClaimAt: number }>;
  onExploreBoxes: () => void;
  canSpin: boolean;
  nextClaimAt: number;
  embedded?: boolean;
  tiers: RewardTier[];
  totalSpent: number;
  hasDeposited: boolean;
}

const countdown = (time: number) => {
  const seconds = Math.max(0, Math.floor((time - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export const DailySpinPage: React.FC<DailySpinPageProps> = ({ onBack, onClaim, onExploreBoxes, canSpin, nextClaimAt, embedded = false, tiers, totalSpent, hasDeposited }) => {
  const [now, setNow] = useState(Date.now());
  const [opening, setOpening] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState("");
  const ordered = useMemo(() => [...tiers].sort((a, b) => a.spendRequired - b.spendRequired), [tiers]);
  const tierIndex = Math.max(0, ordered.findLastIndex((tier) => totalSpent >= tier.spendRequired));
  const tier = ordered[tierIndex] ?? { name: "Starter Box", spendRequired: 0, rewardCoins: 25 };
  const nextTier = ordered[tierIndex + 1];
  const progress = nextTier ? Math.min(100, Math.max(0, ((totalSpent - tier.spendRequired) / (nextTier.spendRequired - tier.spendRequired)) * 100)) : 100;
  const ready = hasDeposited && canSpin && nextClaimAt <= now;

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const claim = async () => {
    if (!ready || opening) return;
    setOpening(true); setError(""); setReward(null);
    try { const result = await onClaim(); setReward(result.amount); setNow(Date.now()); }
    catch (cause) { setError((cause as Error)?.message || "Unable to open your daily box."); }
    finally { setOpening(false); }
  };

  return <main className={`w-full ${embedded ? "min-h-[620px]" : "min-h-[calc(100vh-70px)]"} overflow-hidden rounded-2xl border border-white/10 bg-[#07090d] text-white`}>
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      {onBack && <button onClick={onBack} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/60 hover:text-white"><ChevronLeft className="h-5 w-5"/>Back</button>}
      <header className="mb-7"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-bold text-violet-200"><Sparkles className="h-3.5 w-3.5"/> DAILY REWARDS</div><h1 className="text-3xl font-black tracking-tight sm:text-5xl">Your free box, every day.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Deposit once to unlock daily rewards. Open purchased boxes to level up your free box and earn more.</p></header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="flex min-h-[390px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-b from-[#151128] to-[#0b0d13] p-5 text-center sm:p-8">
          <div className={`relative mb-6 flex h-40 w-40 items-center justify-center rounded-[2rem] border ${ready ? "border-violet-400/40 bg-violet-500/15 shadow-[0_0_70px_rgba(124,58,237,.22)]" : "border-white/10 bg-white/[.03]"}`}><Gift className={`h-20 w-20 ${ready ? "text-violet-300" : "text-slate-600"}`}/><span className="absolute -right-2 -top-2 rounded-full border border-white/10 bg-[#12151d] px-3 py-1 text-xs font-black">LVL {tierIndex + 1}</span></div>
          <h2 className="text-2xl font-black">{tier.name}</h2><div className="mt-2 flex items-center gap-2 text-sm text-slate-300"><img src={COIN_ICON} className="h-5 w-5" alt=""/> Up to <strong className="text-white">{tier.rewardCoins.toLocaleString()} coins</strong></div>
          {reward !== null ? <div className="mt-6 w-full max-w-sm rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200"><Check className="mr-2 inline h-4 w-4"/>You received {reward.toLocaleString()} coins</div> : null}
          {!hasDeposited ? <button onClick={onExploreBoxes} className="mt-7 min-h-12 w-full max-w-sm rounded-xl bg-white px-5 font-black text-black">Make a deposit to unlock</button> : <button onClick={claim} disabled={!ready || opening} className="mt-7 min-h-12 w-full max-w-sm rounded-xl bg-violet-600 px-5 font-black transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">{opening ? "Opening…" : ready ? "Open free box" : `Next box in ${countdown(nextClaimAt)}`}</button>}
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0d1016] p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">Purchased box missions</p><h2 className="mt-1 text-xl font-black">Level up your daily box</h2></div><Box className="h-6 w-6 text-slate-500"/></div>
          {nextTier ? <div className="mt-6"><div className="flex justify-between text-xs font-semibold text-slate-400"><span>{totalSpent.toLocaleString()} coins opened</span><span>{nextTier.spendRequired.toLocaleString()}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-violet-500" style={{width: `${progress}%`}}/></div><p className="mt-2 text-xs text-slate-500">Open {(nextTier.spendRequired-totalSpent).toLocaleString()} more coins in boxes to unlock {nextTier.name}.</p></div> : <p className="mt-5 text-sm text-emerald-300">You unlocked the highest daily reward tier.</p>}
          <div className="mt-6 space-y-2">{ordered.map((item, index) => { const unlocked = totalSpent >= item.spendRequired; return <div key={`${item.name}-${index}`} className={`flex items-center gap-3 rounded-xl border p-3 ${index === tierIndex ? "border-violet-400/30 bg-violet-400/10" : "border-white/5 bg-white/[.02]"}`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${unlocked ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-slate-600"}`}>{unlocked ? <Check className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-[11px] text-slate-500">{item.spendRequired.toLocaleString()} coins in boxes</p></div><span className="text-xs font-bold text-slate-300">{item.rewardCoins.toLocaleString()} coins</span></div>})}</div>
          <button onClick={onExploreBoxes} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5">Explore boxes <ArrowRight className="h-4 w-4"/></button>
        </section>
      </div>
    </div>
  </main>;
};
