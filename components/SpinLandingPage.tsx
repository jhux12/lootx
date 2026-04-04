import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Gift, PackageOpen, ShieldCheck, Sparkles } from 'lucide-react';
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
    <div className="relative h-[15.5rem] overflow-hidden rounded-2xl border border-white/10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_20px_70px_rgba(0,0,0,0.45)] sm:h-64">
      <div
        className={`absolute top-0 bottom-0 left-1/2 z-[26] w-0.5 -translate-x-1/2 transition-opacity duration-300 ${state === 'SPIN' ? 'bg-cyan-300/70 opacity-100' : 'bg-cyan-400/35 opacity-80'}`}
      />
      <div
        className={`absolute inset-y-0 left-1/2 z-[24] w-16 -translate-x-1/2 transition-all duration-500 sm:w-20 ${state === 'SPIN' ? 'opacity-95' : 'opacity-45'}`}
        style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.24) 0%, rgba(34,211,238,0.08) 42%, rgba(34,211,238,0) 75%)' }}
      />
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-24 bg-gradient-to-r from-[#0b0e14] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-24 bg-gradient-to-l from-[#0b0e14] to-transparent" />

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
              className={`relative flex h-[132px] w-[132px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#151a23] p-3 ${idx === STOP_INDEX && state === 'STOPPED' ? 'ring-2 ring-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.45)]' : ''}`}
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

  const featuredRewards = [
    {
      title: 'Pokémon Card',
      value: 'Collector Pull',
      image: 'https://images.unsplash.com/photo-1613771404721-1f92d799e49b?auto=format&fit=crop&w=600&q=80'
    },
    {
      title: 'Tech Drop',
      value: 'Premium Gadget',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80'
    },
    {
      title: 'Gaming Gear',
      value: 'Pro Setup',
      image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=600&q=80'
    }
  ];

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(56,189,248,0.22),transparent_32%),radial-gradient(circle_at_88%_0%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(30,64,175,0.24),transparent_48%),linear-gradient(180deg,#04060d_0%,#090d18_45%,#060914_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-[120px] animate-pulse" />

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

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-8 sm:py-10 animate-[heroFade_700ms_ease-out_forwards]">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 sm:text-xs">
            {['New Users Only', 'Real Items', 'Fair Value Guarantee'].map((badge) => (
              <span key={badge} className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1">{badge}</span>
            ))}
          </div>

          <h1 className="text-balance text-4xl font-black text-white sm:text-6xl">First Pull On Us</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-200 sm:text-xl">Spin to unlock your free mystery box and start with a shot at premium items.</p>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">Create an account to claim your reward after the spin.</p>
        </div>

        <div className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-[1fr_1.55fr_1fr] lg:items-start">
          <div className="order-2 grid gap-3 sm:grid-cols-3 lg:order-1 lg:grid-cols-1">
            {featuredRewards.map((reward, idx) => (
              <div
                key={reward.title}
                className={`group rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-lg transition duration-300 hover:-translate-y-1 ${idx === 1 ? 'lg:translate-x-3' : idx === 2 ? 'lg:-translate-x-2' : ''}`}
              >
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-2">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_60%)]" />
                  <img src={reward.image} alt={reward.title} className="h-20 w-full rounded-lg object-cover sm:h-24" />
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{reward.title}</p>
                <p className="text-xs text-slate-300">{reward.value}</p>
              </div>
            ))}
          </div>

          <div className="order-1 rounded-3xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6 lg:order-2">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-100">
              <Sparkles className="h-3.5 w-3.5" />
              Unlock Your First Pull
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-[#090d18]/80 p-2 shadow-[inset_0_0_60px_rgba(6,182,212,0.08)]">
              <div className="pointer-events-none absolute inset-x-8 top-0 h-16 bg-cyan-300/10 blur-2xl" />
              <PromoCaseSpinner
                items={spinnerItems}
                winningItem={winningItem}
                spinKey={spinKey}
                state={spinnerState}
                durationMs={SPIN_MS}
                onSpinComplete={handleSpinComplete}
              />
            </div>

            <button
              type="button"
              onClick={handleSpin}
              disabled={!canSpin}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSpinning ? 'Unlocking...' : spinResult ? 'Reward Unlocked' : 'Spin For Free'}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400 sm:text-sm">1 free spin per new user</p>

            <div className="mt-4 w-full rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-100 sm:text-sm">
              {hasClaimedFreeBox
                ? 'You already claimed your signup free box on this account.'
                : spinnerItems.length === 0
                  ? 'No daily free box is configured yet. Please check back shortly.'
                  : spinResult
                    ? `Your reward is ready: ${spinResult}.`
                    : 'Spin once to unlock your free signup mystery box reward.'}
            </div>
          </div>

          <div className="order-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-lg">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-100">How It Works</h3>
            <div className="mt-3 grid gap-2">
              {[
                { icon: Sparkles, title: 'Step 1', detail: 'Spin' },
                { icon: PackageOpen, title: 'Step 2', detail: 'Unlock Free Box' },
                { icon: CheckCircle2, title: 'Step 3', detail: 'Claim + Open' }
              ].map((step) => (
                <div key={step.title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                  <step.icon className="h-4 w-4 text-cyan-200" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{step.title}</p>
                    <p className="text-sm font-semibold text-white">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-center text-2xl font-black text-white sm:text-3xl">What You Could Pull</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(spinnerItems.length ? spinnerItems.slice(0, 6) : [winningItem]).map((item, idx) => (
              <div
                key={`${item.itemId ?? item.itemName}-showcase-${idx}`}
                className="min-w-[170px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-lg transition hover:-translate-y-1"
              >
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <div className="pointer-events-none absolute inset-2 rounded-full bg-cyan-300/20 blur-xl" />
                  <img src={item.imageUrl || REWARD_IMAGE} alt={item.itemName} className="relative z-10 mx-auto h-24 w-24 object-contain" />
                </div>
                <p className="mt-3 line-clamp-1 text-sm font-semibold text-white">{item.itemName}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Gift,
              title: 'Real Rewards',
              detail: 'Win items inspired by premium categories'
            },
            {
              icon: ShieldCheck,
              title: 'Fair Value Guarantee',
              detail: 'Built to feel exciting and rewarding'
            },
            {
              icon: PackageOpen,
              title: 'Instant Claim',
              detail: 'Spin and open immediately'
            }
          ].map((card) => (
            <article key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-lg transition duration-300 hover:-translate-y-1">
              <card.icon className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-3 text-lg font-bold text-white">{card.title}</h3>
              <p className="mt-1 text-sm text-slate-300">{card.detail}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-cyan-200/15 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 px-5 py-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-lg sm:px-8">
          <h2 className="text-3xl font-black text-white sm:text-4xl">Your First Pull Is Waiting</h2>
          <button
            type="button"
            onClick={handleSpin}
            disabled={!canSpin}
            className="mt-5 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSpinning ? 'Unlocking...' : spinResult ? 'Reward Unlocked' : 'Spin For Free'}
          </button>
        </div>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-violet-300/30 bg-[#0b1020] p-5 text-center shadow-[0_0_100px_rgba(139,92,246,0.25)] backdrop-blur-lg sm:p-6 animate-[modalIn_300ms_ease-out]">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-cyan-300/25 blur-2xl" />
              <img src={REWARD_IMAGE} alt="Free signup reward box" className="relative mx-auto h-24 w-24 rounded-2xl border border-white/10 object-cover" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">You Unlocked a Free Box</h2>
            <p className="mt-2 text-sm text-slate-300">Create your account to claim your reward</p>

            <button
              type="button"
              onClick={handleClaim}
              disabled={!freeSignupBox}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
        @keyframes heroFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </section>
  );
};
