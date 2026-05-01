import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { COIN_ICON } from '../constants';

type SpinPrize = {
  id: number;
  amount: number;
  image: string;
  angle: number;
};

interface DailySpinPageProps {
  onBack: () => void;
  onSpinStart: () => Promise<{ amount: number }>;
  onSpinClaim: () => Promise<{ amount: number; nextClaimAt: number }>;
  canSpin: boolean;
  nextClaimAt: number;
}

const PRIZES: SpinPrize[] = [
  { id: 1, amount: 10, image: COIN_ICON, angle: 30 },
  { id: 2, amount: 25, image: COIN_ICON, angle: 90 },
  { id: 3, amount: 100, image: COIN_ICON, angle: 150 },
  { id: 4, amount: 500, image: COIN_ICON, angle: 210 },
  { id: 5, amount: 1000, image: COIN_ICON, angle: 270 },
  { id: 6, amount: 2500, image: COIN_ICON, angle: 330 }
];

const BackgroundFloatingCoins = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    {[
      { top: '5%', left: '5%', w: 60, delay: 0 },
      { top: '15%', left: '85%', w: 80, delay: 2 },
      { top: '40%', left: '90%', w: 50, delay: 4 },
      { top: '60%', left: '5%', w: 70, delay: 1 },
      { top: '80%', left: '80%', w: 90, delay: 3 },
      { top: '85%', left: '15%', w: 55, delay: 5 },
      { top: '25%', left: '20%', w: 40, delay: 1.5 },
      { top: '35%', left: '75%', w: 45, delay: 3.5 },
      { top: '55%', left: '50%', w: 100, delay: 0.5 }
    ].map((coin, i) => (
      <img
        key={i}
        src={COIN_ICON}
        alt="floating coin"
        className="absolute opacity-10 grayscale blur-[1px]"
        style={{
          top: coin.top,
          left: coin.left,
          width: `${coin.w}px`,
          animation: 'float 8s ease-in-out infinite',
          animationDelay: `${coin.delay}s`
        }}
      />
    ))}
    <style>{`
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(5deg); }
      }
    `}</style>
  </div>
);

const formatCountdown = (targetTime: number) => {
  const remainingMs = Math.max(0, targetTime - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const DailySpinPage: React.FC<DailySpinPageProps> = ({ onBack, onSpinStart, onSpinClaim, canSpin, nextClaimAt }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastPrize, setLastPrize] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [localNextClaimAt, setLocalNextClaimAt] = useState(nextClaimAt);
  const [countdownNow, setCountdownNow] = useState(Date.now());

  const effectiveNextClaimAt = Math.max(localNextClaimAt, nextClaimAt);

  useEffect(() => {
    const interval = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const canSpinNow = canSpin && effectiveNextClaimAt <= countdownNow;

  const lockLabel = useMemo(() => {
    if (canSpinNow && !isSpinning) return '';
    return formatCountdown(effectiveNextClaimAt);
  }, [canSpinNow, isSpinning, effectiveNextClaimAt, countdownNow]);

  const handleSpin = async () => {
    if (isSpinning || !canSpinNow) return;

    setErrorMessage('');
    setIsSpinning(true);

    try {
      const startResult = await onSpinStart();
      const winner = PRIZES.find((prize) => prize.amount === startResult.amount) ?? PRIZES[0];

      const extraSpins = 5;
      const baseRotation = 360 * extraSpins;
      const targetRotation = rotation + baseRotation + (360 - winner.angle);

      setRotation(targetRotation);
      window.setTimeout(async () => {
        try {
          const claimResult = await onSpinClaim();
          setLocalNextClaimAt(claimResult.nextClaimAt);
          setLastPrize(claimResult.amount || winner.amount);
          setIsSpinning(false);
        } catch (claimError) {
          setIsSpinning(false);
          setErrorMessage((claimError as Error)?.message || 'Unable to claim your spin reward.');
        }
      }, 5000);
    } catch (error) {
      setIsSpinning(false);
      setErrorMessage((error as Error)?.message || 'Unable to spin right now.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center min-h-[calc(100vh-70px)] bg-[#1b2024] relative overflow-hidden rounded-2xl border border-white/5">
      <div className="absolute inset-0 z-0 bg-[#1b2024]">
        <div className="absolute inset-0 bg-gradient-to-t from-[#171c20] via-[#1b2024]/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(148,163,184,0.16),transparent_42%),radial-gradient(circle_at_20%_85%,rgba(255,255,255,0.06),transparent_48%)]" />
        <BackgroundFloatingCoins />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-4 flex w-full justify-start">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
            <span className="font-bold text-sm">Back</span>
          </button>
        </div>

        <div className="flex flex-col items-center mb-8 md:mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase">
            Daily <span className="text-slate-300">Spin</span>
          </h1>
          <p className="text-slate-400 font-medium mt-2">Spin for free coins every 24 hours!</p>
        </div>

        <div className="relative w-[340px] h-[340px] md:w-[510px] md:h-[510px] flex items-center justify-center max-w-full">
          <svg viewBox="0 0 400 400" className="pointer-events-none absolute z-10 overflow-visible w-full h-full scale-[1.02]">
            <path d="M 179.13 133.46 Q 167.80 138.14 162.13 127.25 L 113.55 33.93 Q 107.88 23.04 118.93 17.71 A 199.5 199.5 0 0 1 281.06 17.71 Q 292.11 23.04 286.44 33.93 L 237.86 127.25 Q 232.19 138.14 220.86 133.46 A 69.73 69.73 0 0 0 179.13 133.46 Z" className="fill-transparent stroke-slate-400/70" strokeWidth="5" />
          </svg>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 -mt-2 md:-mt-4 drop-shadow-xl">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[60px] md:w-[86px] h-auto">
              <path d="M30 60L0 0H60L30 60Z" fill="#94a3b8" />
              <path d="M30 50L10 10H50L30 50Z" fill="#64748b" />
            </svg>
          </div>

          <div
            className="relative w-full h-full rounded-full transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1) [--radius:110px] md:[--radius:172.125px]"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="relative w-full h-full overflow-hidden rounded-full border-4 border-white/10 shadow-2xl bg-[#21282c]">
              <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
                <path d="M 215.167 126.549 Q 203.271 125.071 203.794 113.082 L 207.982 17.174 Q 208.505 5.185 220.470 6.077 A 195 195 0 0 1 357.706 85.310 Q 364.461 95.226 354.340 101.674 L 273.375 153.254 Q 263.254 159.702 256.026 150.139 A 75 75 0 0 0 215.167 126.549 Z" className="fill-white/5 stroke-white/10" strokeWidth="2" />
                <path d="M 271.193 176.409 Q 266.525 165.368 277.169 159.827 L 362.322 115.500 Q 372.967 109.959 378.177 120.766 A 195 195 0 0 1 378.177 279.233 Q 372.967 290.040 362.322 284.499 L 277.169 240.172 Q 266.525 234.631 271.193 223.590 A 75 75 0 0 0 271.193 176.409 Z" className="fill-white/5 stroke-neutral-800" strokeWidth="2" />
                <path d="M 256.026 249.860 Q 263.254 240.297 273.375 246.745 L 354.340 298.325 Q 364.461 304.773 357.706 314.689 A 195 195 0 0 1 220.470 393.922 Q 208.505 394.814 207.982 382.825 L 203.794 286.917 Q 203.271 274.928 215.167 273.450 A 75 75 0 0 0 256.026 249.860 Z" className="fill-white/5 stroke-neutral-800" strokeWidth="2" />
                <path d="M 184.832 273.450 Q 196.728 274.928 196.205 286.917 L 192.017 382.825 Q 191.494 394.814 179.529 393.922 A 195 195 0 0 1 42.293 314.689 Q 35.538 304.773 45.659 298.325 L 126.624 246.745 Q 136.745 240.297 143.973 249.860 A 75 75 0 0 0 184.832 273.450 Z" className="fill-white/5 stroke-neutral-800" strokeWidth="2" />
                <path d="M 128.806 223.590 Q 133.474 234.631 122.830 240.172 L 37.677 284.499 Q 27.032 290.040 21.822 279.233 A 195 195 0 0 1 21.822 120.766 Q 27.032 109.959 37.677 115.500 L 122.830 159.827 Q 133.474 165.368 128.806 176.409 A 75 75 0 0 0 128.806 223.590 Z" className="fill-white/5 stroke-neutral-800" strokeWidth="2" />
                <path d="M 143.973 150.139 Q 136.745 159.702 126.624 153.254 L 45.659 101.674 Q 35.538 95.226 42.293 85.310 A 195 195 0 0 1 179.529 6.077 Q 191.494 5.185 192.017 17.174 L 196.205 113.082 Q 196.728 125.071 184.832 126.549 A 75 75 0 0 0 143.973 150.139 Z" className="fill-white/5 stroke-neutral-800" strokeWidth="2" />
              </svg>

              {PRIZES.map((prize) => (
                <div
                  key={prize.id}
                  className="absolute top-1/2 left-1/2 w-[80px] h-[80px] md:w-[80.79px] md:h-[80.79px] flex items-center justify-center"
                  style={{ transform: `translate(-50%, -50%) rotate(${prize.angle}deg) translateY(calc(-1 * var(--radius)))` }}
                >
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img src={prize.image} alt={`${prize.amount}`} className="w-10 h-10 md:w-14 md:h-14 object-contain grayscale pb-4" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#171c20] border border-white/10 rounded-2xl px-3.5 py-1.5 flex items-center justify-center gap-0.5 shadow-lg min-w-[60px]">
                      <span className="text-sm font-bold text-white leading-none pt-0.5">{prize.amount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] md:w-[175px] md:h-[175px] z-30 group">
            <div
              className="absolute inset-0 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: 'conic-gradient(from 0deg, #94a3b8, transparent 40%, transparent 60%, #94a3b8)' }}
            />

            <button
              onClick={handleSpin}
              disabled={isSpinning || !canSpinNow}
              className="relative w-full h-full rounded-full bg-[#1f2730] border-4 border-white/10 shadow-xl flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 z-10"
            >
              {lastPrize ? (
                <>
                  <span className="text-xs md:text-sm font-bold text-neutral-400 uppercase tracking-widest">YOU WON</span>
                  <div className="flex items-center gap-1 md:gap-2 mt-1">
                    <img src={COIN_ICON} alt="Coin" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                    <span className="text-xl md:text-3xl font-black text-white">{lastPrize}</span>
                  </div>
                  <span className="text-[10px] md:text-xs text-neutral-500 mt-2">Come back tomorrow!</span>
                </>
              ) : (
                <>
                  <span className="text-lg md:text-xl font-black text-white uppercase italic tracking-tighter">SPIN NOW</span>
                  <span className="text-[10px] md:text-xs text-slate-300 mt-1 font-medium">Free Daily Reward</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-8 text-neutral-500 font-bold text-sm md:text-base">Resets every 24 hours</p>
        {!canSpinNow && <p className="mt-2 text-xs md:text-sm text-neutral-400">Next spin in {lockLabel || formatCountdown(effectiveNextClaimAt)}</p>}
        {!!errorMessage && <p className="mt-3 text-xs md:text-sm text-red-400 text-center">{errorMessage}</p>}
      </div>
    </div>
  );
};
