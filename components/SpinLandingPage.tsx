import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { createMicroConfetti, type MicroConfettiParticle } from '../src/ui/feedback/microConfetti';
import type { ReelItem } from './SpinnerReel';

const REWARD_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/boxes%2Fu%20(4).png?alt=media&token=2bb02e25-aad4-45b7-b406-46a189ee6f34';
const LOCAL_KEY = 'pullz_spin_free_box_result_v1';
const SPIN_MS = 4200;
const REEL_LENGTH = 40;
const STOP_INDEX = 32;
const CARD_WIDTH = 132;
const CARD_GAP = 12;
const STEP = CARD_WIDTH + CARD_GAP;

type PersistedSpinState = {
  reward: string;
  at: number;
  claimed: boolean;
};

const parseSpinState = (): PersistedSpinState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSpinState>;
    if (!parsed || typeof parsed.reward !== 'string' || parsed.reward.trim().length === 0) {
      return null;
    }
    return {
      reward: parsed.reward,
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

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const PromoCaseSpinner: React.FC<{
  items: ReelItem[];
  winningItem: ReelItem;
  spinKey: string;
  state: 'IDLE' | 'SPIN' | 'STOPPED';
  durationMs: number;
  onSpinComplete: () => void;
}> = ({ items, winningItem, spinKey, state, durationMs, onSpinComplete }) => {
  const [translateX, setTranslateX] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const completeRef = useRef(onSpinComplete);
  const pool = items.length ? items : [winningItem];

  useEffect(() => {
    completeRef.current = onSpinComplete;
  }, [onSpinComplete]);

  const reelItems = useMemo(() => {
    const seed = hashSeed(spinKey);
    const next = Array.from({ length: REEL_LENGTH }, (_, index) => pool[Math.abs((seed + index * 13) % pool.length)]);
    next[STOP_INDEX] = winningItem;
    return next;
  }, [pool, spinKey, winningItem]);

  useEffect(() => {
    if (state === 'IDLE') {
      setTransitionEnabled(false);
      setTranslateX(0);
      return;
    }
    if (state === 'STOPPED') {
      setTransitionEnabled(false);
      setTranslateX(-(STOP_INDEX * STEP));
      return;
    }
    setTransitionEnabled(false);
    setTranslateX(0);
    const frame = window.requestAnimationFrame(() => {
      setTransitionEnabled(true);
      setTranslateX(-(STOP_INDEX * STEP));
    });
    const timer = window.setTimeout(() => completeRef.current(), durationMs + 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [durationMs, state]);

  return (
    <div className="relative h-[15.5rem] overflow-hidden rounded-xl border border-gray-800 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] sm:h-64">
      <div className="absolute top-0 bottom-0 left-1/2 z-[26] w-0.5 -translate-x-1/2 bg-cyan-400/45" />
      <div className="absolute inset-y-0 left-1/2 z-[24] w-16 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.24)_0%,rgba(34,211,238,0.08)_42%,rgba(34,211,238,0)_75%)] sm:w-20" />
      <div className="absolute left-0 top-0 bottom-0 z-20 w-24 bg-gradient-to-r from-[#0b0e14] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 z-20 w-24 bg-gradient-to-l from-[#0b0e14] to-transparent pointer-events-none" />

      <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(50% - ${CARD_WIDTH / 2}px)` }}>
        <div
          className="flex will-change-transform"
          style={{
            gap: `${CARD_GAP}px`,
            transform: `translateX(${translateX}px)`,
            transition: transitionEnabled ? `transform ${durationMs}ms cubic-bezier(0.08, 0.78, 0.22, 1)` : 'none'
          }}
        >
          {reelItems.map((item, idx) => (
            <div
              key={`${item.itemId ?? item.itemName}-${idx}`}
              className={`relative flex h-[132px] w-[132px] shrink-0 flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#151a23] p-3 ${idx === STOP_INDEX && state === 'STOPPED' ? 'ring-2 ring-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.45)]' : ''}`}
            >
              <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.28)_0%,rgba(34,211,238,0.08)_45%,rgba(34,211,238,0)_78%)]" />
              <img src={item.imageUrl || REWARD_IMAGE} alt={item.itemName} className="relative z-10 mb-2 h-20 w-20 object-contain sm:h-24 sm:w-24" />
              <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-cyan-300/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SpinLandingPage: React.FC = () => {
  const { boxes, items, isAuthenticated, user, openAuthModal, setView } = useGame();
  const [spinKey, setSpinKey] = useState('spin-landing-idle');
  const [spinnerState, setSpinnerState] = useState<'IDLE' | 'SPIN' | 'STOPPED'>('IDLE');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [confetti, setConfetti] = useState<MicroConfettiParticle[]>([]);

  const freeSignupBox = useMemo(() => boxes.find((box) => box.isDaily) ?? null, [boxes]);
  const hasClaimedFreeBox = Boolean(user.lastFreeBoxClaim);
  const spinnerItems = useMemo<ReelItem[]>(() => {
    const topGlobal = [...items]
      .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
      .slice(0, 24)
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        value: Number(item.price) || 0,
        rarity: item.rarity,
        imageUrl: item.image
      }));
    if (topGlobal.length >= 8) return topGlobal;
    if (!freeSignupBox?.items?.length) return [];
    return freeSignupBox.items.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      value: Number(item.price) || 0,
      rarity: item.rarity,
      imageUrl: item.image
    }));
  }, [freeSignupBox, items]);

  const winningItem = useMemo<ReelItem>(
    () => ({
      itemId: 'free-signup-box',
      itemName: 'Free Mystery Box',
      value: 0,
      rarity: 'legendary',
      imageUrl: REWARD_IMAGE
    }),
    []
  );

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

  const canSpin = !isSpinning && !spinResult && !hasClaimedFreeBox && spinnerItems.length > 0;

  const handleSpin = () => {
    if (!canSpin) return;

    setIsSpinning(true);
    setSpinnerState('SPIN');
    setSpinKey(`spin-landing-${Date.now()}`);
  };

  const handleSpinComplete = () => {
    if (!isSpinning || spinnerState !== 'SPIN') return;
    setSpinnerState('STOPPED');
    setSpinResult('Free Mystery Box');
    setShowWinModal(true);
    setIsSpinning(false);
    setConfetti(createMicroConfetti(24));
    persistSpinState({ reward: 'Free Mystery Box', at: Date.now(), claimed: false });
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
          <div className="relative w-full max-w-4xl">
            <PromoCaseSpinner
              items={spinnerItems}
              winningItem={winningItem}
              spinKey={spinKey}
              state={spinnerState}
              durationMs={SPIN_MS}
              onSpinComplete={handleSpinComplete}
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
              <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-cyan-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.7)] sm:border-l-[12px] sm:border-r-[12px] sm:border-t-[18px]" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSpin}
            disabled={!canSpin}
            className="mt-6 inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSpinning ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                Spinning...
              </span>
            ) : spinResult ? (
              'Spin Completed'
            ) : (
              'Spin to Win'
            )}
          </button>

          <div className="mt-4 w-full max-w-md rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-100 sm:text-sm">
            {hasClaimedFreeBox
              ? 'You already claimed your signup free box on this account.'
              : spinnerItems.length === 0
                ? 'No daily free box is configured yet. Please check back shortly.'
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
