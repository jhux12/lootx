import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { COIN_ICON } from "../constants";

type SpinPrize = {
  id: number;
  amount: number;
  image: string;
  angle: number;
};

interface DailySpinPageProps {
  onBack?: () => void;
  onSpinStart: () => Promise<{ amount: number }>;
  onSpinClaim: () => Promise<{ amount: number; nextClaimAt: number; expiresAt?: number }>;
  onExploreBoxes: () => void;
  canSpin: boolean;
  nextClaimAt: number;
  embedded?: boolean;
  dailySpinOdds?: Record<string, number>;
}

const WHEEL_HIDE_DELAY_MS = 900;

const DEFAULT_PRIZE_AMOUNTS = [10, 25, 100, 500, 1000, 2500];
const PRIZE_ANGLES = [30, 90, 150, 210, 270, 330];

const getWheelPrizes = (dailySpinOdds?: Record<string, number>): SpinPrize[] => {
  const configuredAmounts = Object.keys(dailySpinOdds ?? {})
    .map((amount) => Math.floor(Number(amount)))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
    .sort((a, b) => a - b);

  const amounts = Array.from(new Set([...configuredAmounts, ...DEFAULT_PRIZE_AMOUNTS])).slice(0, PRIZE_ANGLES.length);

  return amounts.map((amount, index) => ({
    id: index + 1,
    amount,
    image: COIN_ICON,
    angle: PRIZE_ANGLES[index],
  }));
};

const BackgroundFloatingCoins = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    {[
      { top: "5%", left: "5%", w: 60, delay: 0 },
      { top: "15%", left: "85%", w: 80, delay: 2 },
      { top: "40%", left: "90%", w: 50, delay: 4 },
      { top: "60%", left: "5%", w: 70, delay: 1 },
      { top: "80%", left: "80%", w: 90, delay: 3 },
      { top: "85%", left: "15%", w: 55, delay: 5 },
      { top: "25%", left: "20%", w: 40, delay: 1.5 },
      { top: "35%", left: "75%", w: 45, delay: 3.5 },
      { top: "55%", left: "50%", w: 100, delay: 0.5 },
    ].map((coin, i) => (
      <img
        key={i}
        src={COIN_ICON}
        alt="floating coin"
        className="absolute opacity-20 blur-[1px]"
        loading="lazy"
        decoding="async"
        width={coin.w}
        height={coin.w}
        style={{
          top: coin.top,
          left: coin.left,
          width: `${coin.w}px`,
          animation: "float 8s ease-in-out infinite",
          animationDelay: `${coin.delay}s`,
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
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const DailySpinPage: React.FC<DailySpinPageProps> = ({
  onBack,
  onSpinStart,
  onSpinClaim,
  onExploreBoxes,
  canSpin,
  nextClaimAt,
  embedded = false,
  dailySpinOdds,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastPrize, setLastPrize] = useState<number | null>(null);
  const [lastPrizeExpiresAt, setLastPrizeExpiresAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [localNextClaimAt, setLocalNextClaimAt] = useState(nextClaimAt);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [isWheelVisible, setIsWheelVisible] = useState(
    () => canSpin || nextClaimAt <= Date.now(),
  );

  const prizes = useMemo(() => getWheelPrizes(dailySpinOdds), [dailySpinOdds]);
  const effectiveNextClaimAt = Math.max(localNextClaimAt, nextClaimAt);

  useEffect(() => {
    const interval = window.setInterval(
      () => setCountdownNow(Date.now()),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);

  const canSpinNow = canSpin && effectiveNextClaimAt <= countdownNow;
  const hasClaimedDailyBonus =
    !isSpinning && !canSpinNow && effectiveNextClaimAt > countdownNow;
  const showClaimedCard = hasClaimedDailyBonus && !isWheelVisible;

  const lockLabel = useMemo(() => {
    if (canSpinNow && !isSpinning) return "";
    return formatCountdown(effectiveNextClaimAt);
  }, [canSpinNow, isSpinning, effectiveNextClaimAt, countdownNow]);

  useEffect(() => {
    if (!canSpinNow) return;
    setIsWheelVisible(true);
    setLastPrize(null);
  }, [canSpinNow]);

  useEffect(() => {
    if (!hasClaimedDailyBonus) return undefined;

    if (lastPrize === null) {
      setIsWheelVisible(false);
      return undefined;
    }

    const timeout = window.setTimeout(
      () => setIsWheelVisible(false),
      WHEEL_HIDE_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [hasClaimedDailyBonus, lastPrize]);

  const handleSpin = async () => {
    if (isSpinning || !canSpinNow) return;

    setErrorMessage("");
    setIsWheelVisible(true);
    setIsSpinning(true);

    try {
      const startResult = await onSpinStart();
      const winner =
        prizes.find((prize) => prize.amount === startResult.amount) ??
        prizes[0];

      const extraSpins = 5;
      const baseRotation = 360 * extraSpins;
      const targetRotation = rotation + baseRotation + (360 - winner.angle);

      setRotation(targetRotation);
      window.setTimeout(async () => {
        try {
          const claimResult = await onSpinClaim();
          setLocalNextClaimAt(claimResult.nextClaimAt);
          setLastPrize(claimResult.amount || winner.amount);
          setLastPrizeExpiresAt(claimResult.expiresAt ?? Date.now() + 48 * 60 * 60 * 1000);
          setIsSpinning(false);
        } catch (claimError) {
          setIsSpinning(false);
          setErrorMessage(
            (claimError as Error)?.message ||
              "Unable to claim your spin reward.",
          );
        }
      }, 5000);
    } catch (error) {
      setIsSpinning(false);
      setErrorMessage((error as Error)?.message || "Unable to spin right now.");
    }
  };

  return (
    <div
      className={`w-full flex flex-col items-center ${embedded ? "min-h-[560px]" : "min-h-[calc(100vh-70px)]"} bg-neutral-950 relative overflow-hidden rounded-2xl border border-neutral-800`}
    >
      <div className="absolute inset-0 z-0 bg-neutral-950">
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-neutral-950 to-neutral-950" />
        <BackgroundFloatingCoins />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center max-w-6xl mx-auto px-4 py-6 md:py-8">
        {onBack ? (
          <div className="mb-4 flex w-full justify-start">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="font-bold text-sm">Back</span>
            </button>
          </div>
        ) : null}

        <div className="flex flex-col items-center mb-8 md:mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl">
            Daily{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#205DD7] to-sky-300">
              Spin
            </span>
          </h1>
          <p className="text-neutral-400 font-medium mt-2">
            Spin for free coins every 24 hours!
          </p>
        </div>

        {isWheelVisible && (
          <div className="relative w-[340px] h-[340px] md:w-[510px] md:h-[510px] flex items-center justify-center max-w-full">
            <svg
              viewBox="0 0 400 400"
              className="pointer-events-none absolute z-10 overflow-visible w-full h-full scale-[1.02]"
            >
              <path
                d="M 179.13 133.46 Q 167.80 138.14 162.13 127.25 L 113.55 33.93 Q 107.88 23.04 118.93 17.71 A 199.5 199.5 0 0 1 281.06 17.71 Q 292.11 23.04 286.44 33.93 L 237.86 127.25 Q 232.19 138.14 220.86 133.46 A 69.73 69.73 0 0 0 179.13 133.46 Z"
                className="fill-transparent stroke-[#205DD7]"
                strokeWidth="5"
              />
            </svg>

            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 -mt-2 md:-mt-4 drop-shadow-xl">
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-[60px] md:w-[86px] h-auto"
              >
                <path d="M30 60L0 0H60L30 60Z" fill="#2f75ff" />
                <path d="M30 50L10 10H50L30 50Z" fill="#4338ca" />
              </svg>
            </div>

            <div
              className="relative w-full h-full rounded-full transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1) [--radius:110px] md:[--radius:172.125px]"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div className="relative w-full h-full overflow-hidden rounded-full border-4 border-neutral-800 shadow-2xl bg-[#1a1a1a]">
                <svg
                  viewBox="0 0 400 400"
                  className="absolute inset-0 w-full h-full"
                >
                  <path
                    d="M 215.167 126.549 Q 203.271 125.071 203.794 113.082 L 207.982 17.174 Q 208.505 5.185 220.470 6.077 A 195 195 0 0 1 357.706 85.310 Q 364.461 95.226 354.340 101.674 L 273.375 153.254 Q 263.254 159.702 256.026 150.139 A 75 75 0 0 0 215.167 126.549 Z"
                    className="fill-white/5 stroke-neutral-800"
                    strokeWidth="2"
                  />
                  <path
                    d="M 271.193 176.409 Q 266.525 165.368 277.169 159.827 L 362.322 115.500 Q 372.967 109.959 378.177 120.766 A 195 195 0 0 1 378.177 279.233 Q 372.967 290.040 362.322 284.499 L 277.169 240.172 Q 266.525 234.631 271.193 223.590 A 75 75 0 0 0 271.193 176.409 Z"
                    className="fill-white/5 stroke-neutral-800"
                    strokeWidth="2"
                  />
                  <path
                    d="M 256.026 249.860 Q 263.254 240.297 273.375 246.745 L 354.340 298.325 Q 364.461 304.773 357.706 314.689 A 195 195 0 0 1 220.470 393.922 Q 208.505 394.814 207.982 382.825 L 203.794 286.917 Q 203.271 274.928 215.167 273.450 A 75 75 0 0 0 256.026 249.860 Z"
                    className="fill-white/5 stroke-neutral-800"
                    strokeWidth="2"
                  />
                  <path
                    d="M 184.832 273.450 Q 196.728 274.928 196.205 286.917 L 192.017 382.825 Q 191.494 394.814 179.529 393.922 A 195 195 0 0 1 42.293 314.689 Q 35.538 304.773 45.659 298.325 L 126.624 246.745 Q 136.745 240.297 143.973 249.860 A 75 75 0 0 0 184.832 273.450 Z"
                    className="fill-white/5 stroke-neutral-800"
                    strokeWidth="2"
                  />
                  <path
                    d="M 128.806 223.590 Q 133.474 234.631 122.830 240.172 L 37.677 284.499 Q 27.032 290.040 21.822 279.233 A 195 195 0 0 1 21.822 120.766 Q 27.032 109.959 37.677 115.500 L 122.830 159.827 Q 133.474 165.368 128.806 176.409 A 75 75 0 0 0 128.806 223.590 Z"
                    className="fill-white/5 stroke-neutral-800"
                    strokeWidth="2"
                  />
                  <path
                    d="M 143.973 150.139 Q 136.745 159.702 126.624 153.254 L 45.659 101.674 Q 35.538 95.226 42.293 85.310 A 195 195 0 0 1 179.529 6.077 Q 191.494 5.185 192.017 17.174 L 196.205 113.082 Q 196.728 125.071 184.832 126.549 A 75 75 0 0 0 143.973 150.139 Z"
                    className="fill-white/5 stroke-neutral-800"
                    strokeWidth="2"
                  />
                </svg>

                {prizes.map((prize) => (
                  <div
                    key={prize.id}
                    className="absolute top-1/2 left-1/2 w-[80px] h-[80px] md:w-[80.79px] md:h-[80.79px] flex items-center justify-center"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${prize.angle}deg) translateY(calc(-1 * var(--radius)))`,
                    }}
                  >
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <img
                        src={prize.image}
                        alt={`${prize.amount}`}
                        className="w-10 h-10 md:w-14 md:h-14 object-contain drop-shadow-[0_0_15px_rgba(32,93,215,0.5)] pb-4"
                        loading="lazy"
                        decoding="async"
                        width={56}
                        height={56}
                      />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-neutral-950 border border-white/10 rounded-2xl px-3.5 py-1.5 flex items-center justify-center gap-0.5 shadow-lg min-w-[60px]">
                        <span className="text-sm font-bold text-white leading-none pt-0.5">
                          {prize.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] md:w-[175px] md:h-[175px] z-30 group">
              <div
                className="absolute inset-0 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "conic-gradient(from 0deg, #2f75ff, transparent 40%, transparent 60%, #2f75ff)",
                }}
              />

              <button
                onClick={handleSpin}
                disabled={isSpinning || !canSpinNow}
                className="relative w-full h-full rounded-full bg-[#131315] border-4 border-neutral-800 shadow-xl flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 z-10"
              >
                {lastPrize ? (
                  <>
                    <span className="text-xs md:text-sm font-bold text-neutral-400 uppercase tracking-widest">
                      YOU WON
                    </span>
                    <div className="flex items-center gap-1 md:gap-2 mt-1">
                      <img
                        src={COIN_ICON}
                        alt="Coin"
                        className="w-5 h-5 md:w-6 md:h-6 object-contain"
                        loading="lazy"
                        decoding="async"
                        width={24}
                        height={24}
                      />
                      <span className="text-xl md:text-3xl font-black text-white">
                        {lastPrize}
                      </span>
                    </div>
                    <span className="text-[10px] md:text-xs text-neutral-500 mt-2">
                      Come back tomorrow!
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg md:text-xl font-black text-white uppercase italic tracking-tighter">
                      SPIN NOW
                    </span>
                    <span className="text-[10px] md:text-xs text-blue-200 mt-1 font-medium">
                      Free Daily Reward
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {showClaimedCard && (
          <div className="mt-2 w-full max-w-md rounded-3xl border border-sky-300/20 bg-white/[0.06] p-4 text-center shadow-[0_18px_70px_rgba(32,93,215,0.18)] backdrop-blur-md sm:p-5">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-xl font-black text-white sm:text-2xl">
              Daily bonus claimed!
            </p>
            <p className="mt-2 text-sm text-neutral-300">
              Your free reward is locked in as promo coins. Promo coins expire 48 hours after claiming; purchased coins never expire.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-950/55 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200/80">
                Next spin in
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-white tabular-nums">
                {lockLabel || formatCountdown(effectiveNextClaimAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onExploreBoxes}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#205DD7] to-sky-400 px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(32,93,215,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
            >
              Explore Boxes
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <p className="mt-6 text-neutral-500 font-bold text-sm md:text-base">
          Resets every 24 hours
        </p>
        {!canSpinNow && !showClaimedCard && (
          <p className="mt-2 text-xs md:text-sm text-neutral-400">
            Next spin in {lockLabel || formatCountdown(effectiveNextClaimAt)}
          </p>
        )}
        {!!errorMessage && (
          <p className="mt-3 text-xs md:text-sm text-red-400 text-center">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
};
