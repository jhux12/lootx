import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { createMicroConfetti, type MicroConfettiParticle } from '../src/ui/feedback/microConfetti';

const REWARD_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/boxes%2Fu%20(4).png?alt=media&token=2bb02e25-aad4-45b7-b406-46a189ee6f34';
const LOCAL_KEY = 'pullz_spin_free_box_result_v1';
const WINNING_SEGMENTS = ['Starter Box', 'Tech Box', 'Pokémon Box', 'Free Mystery Box'] as const;
const SEGMENTS = ['50 Coins', '100 Coins', 'Try Again', 'Starter Box', 'Tech Box', 'Pokémon Box', 'Free Mystery Box'] as const;
const SEGMENT_COLORS = ['#0f172a', '#1e293b', '#312e81', '#3730a3', '#4338ca', '#6d28d9', '#7c3aed'];
const SPIN_MS = 4200;

type WinningSegment = typeof WINNING_SEGMENTS[number];

type PersistedSpinState = {
  reward: WinningSegment;
  at: number;
  claimed: boolean;
};

const parseSpinState = (): PersistedSpinState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSpinState>;
    if (!parsed || typeof parsed.reward !== 'string' || !WINNING_SEGMENTS.includes(parsed.reward as WinningSegment)) {
      return null;
    }
    return {
      reward: parsed.reward as WinningSegment,
      at: Number(parsed.at) || Date.now(),
      claimed: Boolean(parsed.claimed)
    };
  } catch {
    return null;
  }
};

const persistSpinState = (state: PersistedSpinState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
};

export const SpinLandingPage: React.FC = () => {
  const { boxes, isAuthenticated, user, openAuthModal, setView } = useGame();
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<WinningSegment | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [confetti, setConfetti] = useState<MicroConfettiParticle[]>([]);

  const freeSignupBox = useMemo(() => boxes.find((box) => box.isDaily) ?? null, [boxes]);
  const hasClaimedFreeBox = Boolean(user.lastFreeBoxClaim);

  useEffect(() => {
    const saved = parseSpinState();
    if (saved && !saved.claimed) {
      setSpinResult(saved.reward);
      setShowWinModal(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const saved = parseSpinState();
    if (!saved || saved.claimed || !freeSignupBox || hasClaimedFreeBox) return;

    persistSpinState({ ...saved, claimed: true });
    setView({ type: 'CASE_OPENING', boxId: freeSignupBox.id, isFree: true });
  }, [freeSignupBox, hasClaimedFreeBox, isAuthenticated, setView]);

  useEffect(() => {
    if (confetti.length === 0) return;
    const timer = window.setTimeout(() => setConfetti([]), 1000);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  const winningAngles = useMemo(
    () =>
      Object.fromEntries(
        SEGMENTS.map((label, index) => {
          const segmentSize = 360 / SEGMENTS.length;
          const midAngle = index * segmentSize + segmentSize / 2;
          return [label, 360 - midAngle];
        })
      ) as Record<(typeof SEGMENTS)[number], number>,
    []
  );

  const canSpin = !isSpinning && !spinResult && !hasClaimedFreeBox;

  const handleSpin = () => {
    if (!canSpin) return;

    setIsSpinning(true);
    const selectedReward = WINNING_SEGMENTS[Math.floor(Math.random() * WINNING_SEGMENTS.length)];
    const targetAngle = winningAngles[selectedReward];
    const fullSpins = 6;
    const nextRotation = rotation + fullSpins * 360 + targetAngle;

    setRotation(nextRotation);

    window.setTimeout(() => {
      setSpinResult(selectedReward);
      setShowWinModal(true);
      setIsSpinning(false);
      setConfetti(createMicroConfetti(24));
      persistSpinState({ reward: selectedReward, at: Date.now(), claimed: false });
    }, SPIN_MS);
  };

  const handleClaim = () => {
    if (!freeSignupBox) return;
    const saved = parseSpinState();

    if (isAuthenticated) {
      if (saved) {
        persistSpinState({ ...saved, claimed: true });
      }
      setShowWinModal(false);
      setView({ type: 'CASE_OPENING', boxId: freeSignupBox.id, isFree: true });
      return;
    }

    openAuthModal('register');
  };

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(139,92,246,0.28),transparent_40%),radial-gradient(circle_at_80%_5%,rgba(59,130,246,0.22),transparent_42%),linear-gradient(180deg,#06070c_0%,#0a0d17_100%)]" />

      {confetti.map((piece) => (
        <span
          key={piece.id}
          className="pointer-events-none absolute z-40 rounded-sm"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            width: `${piece.size}px`,
            height: `${piece.size * 1.8}px`,
            backgroundColor: piece.color,
            ['--dx' as string]: `${piece.dx}px`,
            ['--dy' as string]: `${piece.dy}px`,
            animation: `spin-win-pop ${piece.life}ms ease-out forwards`
          }}
        />
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" />
          New Users Only
        </span>

        <h1 className="text-balance text-3xl font-black text-white sm:text-5xl">Spin For Your First Free Box</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">New users only — win a free mystery box.</p>

        <div className="mt-8 flex w-full flex-col items-center rounded-3xl border border-white/10 bg-[#090d18]/80 p-4 shadow-[0_0_120px_rgba(124,58,237,0.12)] backdrop-blur-sm sm:p-8">
          <div className="relative h-[320px] w-[320px] max-w-full sm:h-[500px] sm:w-[500px]">
            <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]">
              <div className="h-0 w-0 border-x-[16px] border-b-[28px] border-x-transparent border-b-cyan-300 sm:border-x-[20px] sm:border-b-[36px]" />
            </div>

            <div
              className="relative h-full w-full rounded-full border-[6px] border-violet-400/30 shadow-[0_0_60px_rgba(139,92,246,0.35)] transition-transform duration-[4200ms] [transition-timing-function:cubic-bezier(0.14,0.74,0.19,1)]"
              style={{
                transform: `rotate(${rotation}deg)`,
                background: `conic-gradient(${SEGMENT_COLORS.map((color, index) => `${color} ${(360 / SEGMENTS.length) * index}deg ${(360 / SEGMENTS.length) * (index + 1)}deg`).join(',')})`
              }}
            >
              {SEGMENTS.map((segment, index) => {
                const angle = (360 / SEGMENTS.length) * index + 360 / SEGMENTS.length / 2;
                const radius = 110;
                const radian = (angle * Math.PI) / 180;
                const x = 50 + (radius * Math.cos(radian)) / 2.5;
                const y = 50 + (radius * Math.sin(radian)) / 2.5;

                return (
                  <div
                    key={segment}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`
                    }}
                  >
                    <span className="block max-w-[72px] text-[10px] font-bold uppercase tracking-wide text-white sm:max-w-[110px] sm:text-xs">{segment}</span>
                  </div>
                );
              })}

              <div className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0f1322] shadow-[0_0_40px_rgba(56,189,248,0.2)] sm:h-36 sm:w-36">
                <button
                  type="button"
                  onClick={handleSpin}
                  disabled={!canSpin}
                  className="group relative h-20 w-20 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 sm:h-24 sm:w-24"
                >
                  {isSpinning ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-950">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                      Spinning
                    </span>
                  ) : spinResult ? (
                    'Won'
                  ) : (
                    'Spin'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 w-full max-w-md rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-100 sm:text-sm">
            {hasClaimedFreeBox
              ? 'You already claimed your signup free box on this account.'
              : spinResult
                ? `Your reward is ready: ${spinResult}.`
                : 'Spin once to unlock your free signup mystery box reward.'}
          </div>
        </div>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-violet-300/30 bg-[#0b1020] p-5 text-center shadow-[0_0_100px_rgba(139,92,246,0.25)] sm:p-6">
            <img src={REWARD_IMAGE} alt="Free signup reward box" className="mx-auto h-20 w-20 rounded-xl border border-white/10 object-cover sm:h-24 sm:w-24" />
            <h2 className="mt-4 text-2xl font-black text-white">You Won a Free Box 🎉</h2>
            <p className="mt-2 text-sm text-slate-300">Create an account to claim your reward.</p>

            <button
              type="button"
              onClick={handleClaim}
              disabled={!freeSignupBox}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Gift className="h-4 w-4" />
              Claim Free Box
            </button>
            {!freeSignupBox && <p className="mt-2 text-xs text-red-300">No free signup box is currently configured.</p>}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin-win-pop {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(210deg); }
        }
      `}</style>
    </section>
  );
};
