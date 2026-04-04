import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react';
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
      <div className={`absolute top-0 bottom-0 left-1/2 z-[26] w-0.5 -translate-x-1/2 transition-opacity duration-300 ${state === 'SPIN' ? 'bg-cyan-300/60 opacity-100' : 'bg-cyan-400/35 opacity-80'}`} />
      <div className={`absolute inset-y-0 left-1/2 z-[24] w-16 -translate-x-1/2 transition-all duration-500 sm:w-20 ${state === 'SPIN' ? 'opacity-90' : 'opacity-40'}`} style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.24) 0%, rgba(34,211,238,0.08) 42%, rgba(34,211,238,0) 75%)' }} />
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

  const featuredRewards = useMemo(
    () => [
      {
        title: 'Pokemon Card',
        image: spinnerItems[0]?.imageUrl || REWARD_IMAGE,
        accent: 'from-fuchsia-400/35 to-violet-300/5'
      },
      {
        title: 'Tech Item',
        image: spinnerItems[1]?.imageUrl || REWARD_IMAGE,
        accent: 'from-cyan-300/35 to-sky-300/5'
      },
      {
        title: 'Gaming Item',
        image: spinnerItems[2]?.imageUrl || REWARD_IMAGE,
        accent: 'from-indigo-300/35 to-blue-300/5'
      }
    ],
    [spinnerItems]
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_6%,rgba(168,85,247,0.3),transparent_40%),radial-gradient(circle_at_78%_0%,rgba(34,211,238,0.24),transparent_44%),radial-gradient(circle_at_50%_70%,rgba(59,130,246,0.15),transparent_42%),linear-gradient(180deg,#05070c_0%,#080b14_100%)]" />
      <div className="pointer-events-none absolute -top-36 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />

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

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="animate-[fade-in_700ms_ease-out] text-center">
          <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-xl">
            {['New Users Only', 'Real Items', 'Fair Value Guarantee'].map((badge) => (
              <span key={badge} className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 sm:text-[11px]">
                {badge}
              </span>
            ))}
          </div>

          <h1 className="mt-5 text-balance text-4xl font-black leading-tight text-white sm:text-6xl">First Pull On Us</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 sm:text-lg">Spin to unlock your free mystery box and start with a shot at premium items.</p>
          <p className="mx-auto mt-2 max-w-xl text-xs text-slate-300 sm:text-sm">Create an account to claim your reward after the spin.</p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-3 shadow-[0_20px_100px_rgba(17,24,39,0.65)] backdrop-blur-2xl sm:p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_minmax(0,2fr)_1fr]">
            <aside className="order-2 flex flex-row gap-3 overflow-x-auto pb-1 xl:order-1 xl:flex-col xl:overflow-visible">
              {featuredRewards.map((reward, index) => (
                <div
                  key={reward.title}
                  className="group relative min-w-[170px] flex-1 rounded-2xl border border-white/10 bg-slate-950/40 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${reward.accent} opacity-80`} />
                  <div className="relative flex items-center gap-3">
                    <img src={reward.image} alt={reward.title} className="h-14 w-14 rounded-xl border border-white/20 bg-black/30 object-contain sm:h-16 sm:w-16" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">Featured Reward</p>
                      <p className="text-sm font-semibold text-white">{reward.title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </aside>

            <main className="order-1 rounded-2xl border border-white/10 bg-[#080d17]/75 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:p-6 xl:order-2">
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Unlock Your First Pull</p>
              <div className="relative rounded-2xl border border-cyan-200/20 bg-black/30 p-2 shadow-[0_0_40px_rgba(34,211,238,0.12)] sm:p-3">
                <div className={`pointer-events-none absolute inset-0 rounded-2xl ${spinnerState === 'IDLE' ? 'animate-pulse' : ''}`} style={{ background: 'radial-gradient(circle at center, rgba(34,211,238,0.14), rgba(34,211,238,0) 65%)' }} />
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
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSpinning ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Unlocking...
                  </span>
                ) : spinResult ? (
                  'Reward Unlocked'
                ) : (
                  'Spin For Free'
                )}
              </button>

              <p className="mt-2 text-center text-xs text-slate-300">1 free spin per new user</p>

              <div className="mt-4 w-full rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-center text-xs text-violet-100 sm:text-sm">
                {hasClaimedFreeBox
                  ? 'You already claimed your signup free box on this account.'
                  : spinnerItems.length === 0
                    ? 'No daily free box is configured yet. Please check back shortly.'
                    : spinResult
                      ? `Your reward is ready: ${spinResult}.`
                      : 'Spin once to unlock your free signup mystery box reward.'}
              </div>
            </main>

            <aside className="order-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">How It Works</p>
              <div className="space-y-2.5">
                {[
                  { icon: Sparkles, title: 'Step 1', text: 'Spin' },
                  { icon: Star, title: 'Step 2', text: 'Unlock Free Box' },
                  { icon: Gift, title: 'Step 3', text: 'Claim + Open' }
                ].map((step) => (
                  <div key={step.title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <step.icon className="h-4 w-4 text-cyan-200" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">{step.title}</p>
                      <p className="text-sm font-medium text-white">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">What You Could Pull</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {(spinnerItems.length ? spinnerItems.slice(0, 6) : [winningItem]).map((item, idx) => (
              <article key={`${item.itemId}-${idx}`} className="group relative min-w-[150px] rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 sm:min-w-[180px]">
                <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),rgba(34,211,238,0))] opacity-80" />
                <img src={item.imageUrl || REWARD_IMAGE} alt={item.itemName} className="relative z-10 mx-auto h-20 w-20 object-contain sm:h-24 sm:w-24" />
                <p className="relative z-10 mt-2 line-clamp-2 text-center text-xs font-semibold text-slate-100 sm:text-sm">{item.itemName}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Gift, title: 'Real Rewards', text: 'Win items inspired by premium categories' },
            { icon: ShieldCheck, title: 'Fair Value Guarantee', text: 'Built to feel exciting and rewarding' },
            { icon: Zap, title: 'Instant Claim', text: 'Spin and open immediately' }
          ].map((card) => (
            <article key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35">
              <card.icon className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-3 text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-1 text-sm text-slate-300">{card.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-cyan-200/20 bg-gradient-to-r from-cyan-400/10 via-blue-500/10 to-violet-500/10 p-6 text-center backdrop-blur-xl">
          <h2 className="text-2xl font-black text-white sm:text-3xl">Your First Pull Is Waiting</h2>
          <button
            type="button"
            onClick={handleSpin}
            disabled={!canSpin}
            className="mt-4 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSpinning ? 'Unlocking...' : spinResult ? 'Reward Unlocked' : 'Spin For Free'}
          </button>
        </section>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-300/25 bg-[#0a1020]/95 p-5 text-center shadow-[0_0_100px_rgba(34,211,238,0.2)] sm:p-6">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
              <img src={REWARD_IMAGE} alt="Free signup reward box" className="relative z-10 mx-auto h-24 w-24 rounded-xl border border-white/10 object-cover" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">You Unlocked a Free Box</h2>
            <p className="mt-2 text-sm text-slate-300">Create your account to claim your reward</p>

            <button
              type="button"
              onClick={handleClaim}
              disabled={!freeSignupBox}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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

        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
};
