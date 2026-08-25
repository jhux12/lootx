import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, Crown, Gift, LockKeyhole, RefreshCw, Sparkles, Timer } from "lucide-react";
import { COIN_ICON } from "../constants";

type SpinPrize = { id: number; amount: number; angle: number };

interface DailySpinPageProps {
  onBack?: () => void;
  onSpinStart: () => Promise<{ amount: number; nextClaimAt?: number }>;
  onSpinClaim: () => Promise<{ amount: number; nextClaimAt: number }>;
  onExploreBoxes: () => void;
  canSpin: boolean;
  nextClaimAt: number;
  embedded?: boolean;
  dailySpinOdds?: Record<string, number>;
}

const DEFAULT_PRIZES = [50, 5, 10, 25, 100, 250];
const getPrizes = (odds?: Record<string, number>): SpinPrize[] => {
  const configured = Object.keys(odds ?? {}).map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  return Array.from(new Set([...configured, ...DEFAULT_PRIZES])).slice(0, 6).map((amount, index) => ({ id: index, amount, angle: index * 60 + 30 }));
};

const formatCountdown = (target: number) => {
  const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const milestones = [
  { amount: "$50", reward: "250 Coins", icon: "coins" },
  { amount: "$250", reward: "1,000 Coins", icon: "coins" },
  { amount: "$500", reward: "VIP + Early Access", icon: "vip" },
];

export const DailySpinPage: React.FC<DailySpinPageProps> = ({ onBack, onSpinStart, onSpinClaim, canSpin, nextClaimAt, embedded = false, dailySpinOdds }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastPrize, setLastPrize] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [localNextClaimAt, setLocalNextClaimAt] = useState(nextClaimAt);
  const [now, setNow] = useState(Date.now());
  const prizes = useMemo(() => getPrizes(dailySpinOdds), [dailySpinOdds]);
  const effectiveNextClaimAt = Math.max(localNextClaimAt, nextClaimAt);
  const canSpinNow = canSpin && effectiveNextClaimAt <= now;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSpin = async () => {
    if (isSpinning || !canSpinNow) return;
    setError("");
    setIsSpinning(true);
    try {
      const started = await onSpinStart();
      const winner = prizes.find((prize) => prize.amount === started.amount) ?? prizes[0];
      if (started.nextClaimAt) setLocalNextClaimAt(started.nextClaimAt);
      setRotation((value) => value + 1800 + (360 - winner.angle));
      window.setTimeout(async () => {
        try {
          const claimed = await onSpinClaim();
          setLocalNextClaimAt(claimed.nextClaimAt);
          setLastPrize(claimed.amount || winner.amount);
        } catch (claimError) {
          setError((claimError as Error)?.message || "Unable to claim your reward.");
        } finally {
          setIsSpinning(false);
        }
      }, 5000);
    } catch (spinError) {
      setError((spinError as Error)?.message || "Unable to spin right now.");
      setIsSpinning(false);
    }
  };

  return (
    <main className={`${embedded ? "min-h-[700px]" : "min-h-[calc(100vh-70px)]"} relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050711] text-white`}>
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
          <div className="relative z-10 max-w-[70%] sm:max-w-[65%]"><p className="flex items-center gap-2 text-xs font-black sm:text-sm"><Sparkles className="h-4 w-4" /> YOUR PROGRESS <span className="text-violet-400">↟</span></p><p className="mt-3 text-4xl font-black text-violet-500 sm:text-6xl">$32 <span className="text-xl text-slate-300 sm:text-3xl">/ $50</span></p><p className="mt-3 font-semibold text-slate-300"><span className="text-violet-400">$18</span> until your next reward</p><p className="mt-2 flex items-center gap-2 font-bold"><img src={COIN_ICON} className="h-5 w-5" alt="" /> 250 bonus coins</p></div>
          <div className="absolute right-4 top-10 sm:right-10"><div className="relative h-24 w-28 sm:h-36 sm:w-44"><img src={COIN_ICON} alt="Bonus coins" className="absolute bottom-0 right-2 h-20 w-20 drop-shadow-[0_0_22px_rgba(255,183,0,.45)] sm:h-32 sm:w-32" /><img src={COIN_ICON} alt="" className="absolute bottom-3 left-0 h-12 w-12 opacity-80 sm:h-20 sm:w-20" /></div></div>
          <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-slate-700/60 ring-1 ring-white/10"><div className="h-full w-[64%] rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-400 shadow-[0_0_16px_rgba(90,100,255,.7)]" /></div><p className="mt-1 text-right text-xs font-bold text-violet-400">64%</p>
        </section>

        <section className="mb-8"><div className="mb-5 flex items-baseline gap-3"><h2 className="flex items-center gap-2 text-base font-black sm:text-lg"><Crown className="h-5 w-5 text-yellow-400" /> MILESTONE REWARDS</h2><p className="hidden text-xs text-slate-400 sm:block">Lifetime deposits unlock bigger rewards.</p></div>
          <div className="grid gap-3 lg:grid-cols-3 lg:gap-8">{milestones.map((milestone, index) => <article key={milestone.amount} className={`relative flex min-h-20 items-center rounded-xl border bg-gradient-to-br from-[#101629] to-[#090d17] p-4 lg:min-h-56 lg:flex-col lg:justify-center lg:text-center ${index === 0 ? "border-violet-500 shadow-[0_0_30px_rgba(124,58,237,.12)]" : "border-slate-700/60"}`}><span className={`absolute left-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-xs font-black lg:left-1/2 lg:top-[-12px] lg:-translate-x-1/2 lg:translate-y-0 ${index === 0 ? "bg-violet-600" : "bg-slate-600"}`}>{index + 1}</span><div className="ml-9 flex flex-1 items-center gap-3 lg:ml-0 lg:flex-col"><span className="grid h-12 w-12 place-items-center rounded-xl bg-black/25">{milestone.icon === "vip" ? <span className="font-black text-yellow-400">VIP</span> : <img src={COIN_ICON} alt="" className="h-10 w-10" />}</span><div><p className={`text-xl font-black ${index === 1 ? "text-blue-400" : "text-violet-400"}`}>{milestone.amount}</p><p className="text-xs text-slate-300">Total Deposited</p></div></div><span className="rounded-full bg-violet-900/70 px-4 py-2 text-xs font-bold sm:text-sm">{milestone.reward}</span>{index > 0 && <LockKeyhole className="absolute right-2 top-2 h-4 w-4 text-slate-500" />}</article>)}</div>
          <p className="mt-4 text-xs text-slate-500 lg:text-center">Milestones are based on your lifetime deposits. Rewards are added automatically.</p>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-[#11163a] to-[#090d20] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black sm:text-xl"><RefreshCw className="h-5 w-5 text-violet-300" /> DAILY REWARD</h2><p className="mt-1 text-xs text-slate-300 sm:text-sm">Spin once every 24 hours for free coins!</p></div><span className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs"><Timer className="h-4 w-4" /> {canSpinNow ? "Ready to spin" : `Resets in ${formatCountdown(effectiveNextClaimAt)}`}</span></div>
          <div className="relative mx-auto mt-8 h-[290px] w-[290px] sm:h-[390px] sm:w-[390px]">
            <div className="absolute left-1/2 top-[-12px] z-30 -translate-x-1/2 border-x-[24px] border-t-[42px] border-x-transparent border-t-violet-500 drop-shadow-[0_0_12px_#7c3aed]" />
            <div className="absolute inset-0 rounded-full border-4 border-slate-600/70 bg-[repeating-conic-gradient(from_-30deg,#171c2d_0deg_59deg,#0d1220_59deg_60deg)] shadow-2xl transition-transform duration-[5000ms] ease-[cubic-bezier(.15,0,.15,1)]" style={{ transform: `rotate(${rotation}deg)` }}>{prizes.map((prize) => <div key={prize.id} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${prize.angle}deg) translateY(-${embedded ? 112 : 112}px)` }}><div className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ transform: `rotate(-${prize.angle}deg)` }}><img src={COIN_ICON} alt="" className="h-8 w-8 sm:h-10 sm:w-10" /><b className="text-sm">{prize.amount}</b></div></div>)}</div>
            <button onClick={handleSpin} disabled={isSpinning || !canSpinNow} className="absolute left-1/2 top-1/2 z-20 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border-2 border-slate-700 bg-[#080b14] text-center shadow-xl transition hover:border-violet-500 disabled:cursor-not-allowed disabled:opacity-70 sm:h-36 sm:w-36"><span className="font-black">{isSpinning ? "SPINNING" : lastPrize ? `YOU WON ${lastPrize}` : canSpinNow ? "SPIN NOW" : "CLAIMED"}</span><span className="mt-1 text-[10px] text-slate-400">Free Daily Reward</span></button>
          </div>
          {!canSpinNow && <div className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Daily reward claimed</div>}{error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
        </section>
      </div>
    </main>
  );
};
