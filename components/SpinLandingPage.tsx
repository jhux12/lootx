import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, ShieldCheck, Sparkles, Zap } from 'lucide-react';
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

const rarityStyles = (rarity?: string) => {
  const label = (rarity || 'common').toLowerCase();
  if (label.includes('legendary')) {
    return {
      bar: 'from-amber-300/90 via-orange-400/90 to-yellow-300/90',
      glow: 'shadow-[0_0_26px_rgba(251,191,36,0.3)]',
      chip: 'border-amber-300/50 bg-amber-400/20 text-amber-100'
    };
  }
  if (label.includes('epic')) {
    return {
      bar: 'from-fuchsia-300/90 via-violet-400/90 to-purple-300/90',
      glow: 'shadow-[0_0_24px_rgba(192,132,252,0.28)]',
      chip: 'border-fuchsia-300/45 bg-fuchsia-400/20 text-fuchsia-100'
    };
  }
  if (label.includes('rare')) {
    return {
      bar: 'from-cyan-300/90 via-sky-400/90 to-blue-300/90',
      glow: 'shadow-[0_0_22px_rgba(56,189,248,0.24)]',
      chip: 'border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
    };
  }
  return {
    bar: 'from-slate-300/85 via-slate-400/85 to-zinc-300/85',
    glow: 'shadow-[0_0_18px_rgba(148,163,184,0.18)]',
    chip: 'border-slate-300/30 bg-slate-400/10 text-slate-200'
  };
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
    <div className="relative h-[15.5rem] overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(9,13,24,0.96)_0%,rgba(7,10,18,0.9)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_80px_rgba(0,0,0,0.45)] sm:h-72">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.12),transparent_58%)]" />
      <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-violet-200/30 to-transparent" />

      <div
        className={`absolute top-0 bottom-0 left-1/2 z-[26] w-[2px] -translate-x-1/2 transition-opacity duration-300 ${state === 'SPIN' ? 'bg-cyan-200/90 opacity-100' : 'bg-cyan-300/65 opacity-80'}`}
      />
      <div
        className={`absolute inset-y-3 left-1/2 z-[24] w-[90px] -translate-x-1/2 rounded-2xl border border-cyan-300/25 bg-cyan-300/5 transition-all duration-500 sm:w-28 ${state === 'SPIN' ? 'animate-[zonePulse_1.6s_ease-in-out_infinite] opacity-95' : 'opacity-70'}`}
      />
      <div
        className={`absolute inset-y-0 left-1/2 z-[22] w-20 -translate-x-1/2 transition-all duration-500 sm:w-24 ${state === 'SPIN' ? 'opacity-95' : 'opacity-55'}`}
        style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.28) 0%, rgba(34,211,238,0.08) 42%, rgba(34,211,238,0) 75%)' }}
      />

      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-20 bg-gradient-to-r from-[#080c15] via-[#080c15]/90 to-transparent sm:w-24" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-20 bg-gradient-to-l from-[#080c15] via-[#080c15]/90 to-transparent sm:w-24" />

      <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(50% - ${CARD_WIDTH / 2}px)` }}>
        <div
          className="flex will-change-transform"
          style={{
            gap: `${CARD_GAP}px`,
            transform: `translateX(${translateX}px)`,
            transition: transitionEnabled ? `transform ${durationMs}ms cubic-bezier(0.08, 0.78, 0.22, 1)` : 'none'
          }}
        >
          {reelItems.map((item, idx) => {
            const rarity = rarityStyles(item.rarity);
            return (
              <div
                key={`${item.itemId ?? item.itemName}-${idx}`}
                className={`group relative flex h-[132px] w-[132px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#131a28] p-3 backdrop-blur-sm ${rarity.glow} ${idx === STOP_INDEX && state === 'STOPPED' ? 'ring-2 ring-cyan-300/80 shadow-[0_0_30px_rgba(34,211,238,0.42)]' : ''}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0)_44%)]" />
                <div className="pointer-events-none absolute inset-4 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(34,211,238,0.08)_40%,rgba(34,211,238,0)_72%)]" />
                <img src={item.imageUrl || REWARD_IMAGE} alt={item.itemName} className="relative z-10 mb-2 h-20 w-20 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24" />
                <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${rarity.bar}`} />
              </div>
            );
          })}
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

  const rewardPreview = useMemo(() => spinnerItems.slice(0, 6), [spinnerItems]);

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
  const spinStateLabel = isSpinning ? 'Finding your reward...' : spinResult ? 'Unlocked' : 'Take your shot';

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
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden px-3 py-5 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(168,85,247,0.24),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.17),transparent_36%),radial-gradient(circle_at_50%_38%,rgba(99,102,241,0.12),transparent_48%),linear-gradient(180deg,#05070d_0%,#080c16_44%,#060913_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:42px_42px] animate-[gridRotate_24s_linear_infinite]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-[110px] animate-[floatAura_8s_ease-in-out_infinite]" />

      {[...Array.from({ length: 10 })].map((_, i) => (
        <span
          key={`particle-${i}`}
          className="pointer-events-none absolute rounded-full bg-cyan-200/45"
          style={{
            left: `${8 + i * 9}%`,
            top: `${14 + ((i * 11) % 70)}%`,
            width: `${i % 2 === 0 ? 2 : 1.5}px`,
            height: `${i % 2 === 0 ? 2 : 1.5}px`,
            animation: `floatParticle ${7 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`
          }}
        />
      ))}

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

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <div className="animate-[fadeRise_600ms_ease-out] rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                New Users Only
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/35 bg-violet-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100">
                <Gift className="h-3.5 w-3.5" />
                Real Items
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fair Value Guarantee
              </span>
            </div>

            <h1 className="text-balance text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl">First Pull On Us</h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-slate-200/95 sm:text-lg">
              Spin to unlock your free mystery box and start with a real shot at premium items.
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-cyan-200/85 sm:text-sm">New users only. No code needed.</p>
          </div>

          <div className="relative mx-auto mt-6 w-full max-w-5xl rounded-3xl border border-cyan-300/20 bg-[#090f1d]/80 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_85px_rgba(14,165,233,0.08)] sm:mt-8 sm:p-6">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
            <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-200/35 to-transparent" />

            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 sm:text-sm">{spinStateLabel}</p>

            <div className={`relative ${!isSpinning && !spinResult ? 'animate-[idlePulse_2.4s_ease-in-out_infinite]' : ''}`}>
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
              className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/45 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-6 py-3 text-base font-black uppercase tracking-[0.15em] text-slate-950 shadow-[0_10px_35px_rgba(34,211,238,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:mx-auto sm:max-w-md sm:text-lg sm:tracking-[0.18em]"
            >
              {isSpinning ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                  Unlocking...
                </span>
              ) : spinResult ? (
                'Reward Unlocked'
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Spin For Free
                </>
              )}
            </button>

            <p className="mt-2 text-center text-[11px] text-slate-400 sm:text-xs">1 free spin per new user</p>

            <div className="mt-4 w-full rounded-2xl border border-violet-300/20 bg-violet-400/10 p-3 text-xs text-violet-100 sm:mx-auto sm:max-w-xl sm:text-sm">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            {
              title: 'Real Rewards',
              text: 'Win items inspired by the same premium categories featured across Pullz.gg.',
              icon: Gift
            },
            {
              title: 'Fair Value Guarantee',
              text: 'Every box is built to feel exciting, transparent, and worth opening.',
              icon: ShieldCheck
            },
            {
              title: 'Instant Claim',
              text: 'Win your free box, create your account, and jump straight into your first pull.',
              icon: Zap
            }
          ].map((card) => (
            <article
              key={card.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_16px_35px_rgba(0,0,0,0.33)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/25"
            >
              <card.icon className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-3 text-sm font-bold text-white sm:text-base">{card.title}</h3>
              <p className="mt-1.5 text-xs text-slate-300 sm:text-sm">{card.text}</p>
            </article>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white sm:text-2xl">What You Could Pull</h2>
              <p className="mt-1 text-xs text-slate-300 sm:text-sm">A preview of reward styles featured in the Pullz.gg experience.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rewardPreview.map((item, idx) => {
              const rarity = rarityStyles(item.rarity);
              return (
                <article
                  key={`${item.itemId ?? item.itemName}-preview-${idx}`}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#111827]/80 p-3 transition duration-300 hover:-translate-y-1 ${rarity.glow}`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_40%)]" />
                  <div className="pointer-events-none absolute -top-8 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-cyan-200/20 blur-2xl" />

                  <div className="relative z-10 flex justify-center">
                    <img src={item.imageUrl || REWARD_IMAGE} alt={item.itemName} className="h-20 w-20 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)] sm:h-24 sm:w-24" />
                  </div>

                  <p className="relative z-10 mt-3 line-clamp-2 min-h-[2.3rem] text-xs font-semibold text-slate-100 sm:text-sm">{item.itemName}</p>
                  <span className={`relative z-10 mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rarity.chip}`}>
                    {item.rarity || 'common'}
                  </span>
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5">
          <div className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-center sm:gap-6 sm:text-sm">
            <p>Built for fast, fun, low-friction first pulls.</p>
            <p>Designed to get you into the action instantly.</p>
            <p>Best experienced on mobile and desktop.</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-100 sm:mx-auto sm:max-w-lg sm:text-xs">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-1">Instant spin</span>
            <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-1">Free first box</span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1">Real item categories</span>
          </div>
        </div>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02040a]/84 p-3 sm:p-6">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-violet-300/30 bg-[linear-gradient(180deg,#0b1020_0%,#0a1022_100%)] p-5 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_rgba(124,58,237,0.45)] sm:p-7">
            <div className="pointer-events-none absolute -top-8 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-cyan-300/30 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

            <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] sm:h-32 sm:w-32">
              <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.4)_0%,rgba(34,211,238,0.1)_55%,rgba(34,211,238,0)_78%)]" />
              <img src={REWARD_IMAGE} alt="Free signup reward box" className="relative z-10 h-20 w-20 object-contain sm:h-24 sm:w-24" />
            </div>

            <h2 className="text-2xl font-black text-white sm:text-3xl">You Unlocked a Free Box</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-200 sm:text-base">Create your account to claim it and open your first Pullz box.</p>
            <p className="mt-1 text-xs text-cyan-200/90">Your free box is ready to claim.</p>

            <button
              type="button"
              onClick={handleClaim}
              disabled={!freeSignupBox}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/40 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-4 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              <Gift className="h-4 w-4" />
              Claim Free Box
            </button>

            <button
              type="button"
              onClick={() => setShowWinModal(false)}
              className="mt-2 inline-flex items-center justify-center text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              Maybe later
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

        @keyframes fadeRise {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes floatAura {
          0%, 100% { transform: translateX(-50%) translateY(0px); }
          50% { transform: translateX(-50%) translateY(14px); }
        }

        @keyframes floatParticle {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.4; }
          50% { transform: translateY(-14px) scale(1.2); opacity: 0.9; }
        }

        @keyframes zonePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.08), inset 0 0 0 1px rgba(34, 211, 238, 0.18); }
          50% { box-shadow: 0 0 0 10px rgba(34, 211, 238, 0), inset 0 0 0 1px rgba(34, 211, 238, 0.36); }
        }

        @keyframes idlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.004); }
        }

        @keyframes gridRotate {
          0% { transform: rotate(0deg) scale(1.08); }
          100% { transform: rotate(360deg) scale(1.08); }
        }
      `}</style>
    </section>
  );
};
