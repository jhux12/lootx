import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Sparkles, User } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { setPostSignupRedirect } from '../utils/postSignupRedirect';
import { trackEvent } from '../utils/trackEvent';
import { subscribeHomepageConfig } from '../utils/homepageShowcase';
import { getBoxTags } from '../utils/boxTags';

const PRIZE_SKELETON_COUNT = 6;
const SPARKLE_DOTS = [
  'left-[8%] top-[18%] h-2 w-2 bg-cyan-300/80',
  'left-[18%] top-[72%] h-1.5 w-1.5 bg-fuchsia-300/80',
  'right-[14%] top-[20%] h-2.5 w-2.5 bg-amber-200/80',
  'right-[7%] top-[62%] h-1.5 w-1.5 bg-emerald-300/80'
];

export const SpinLandingPage: React.FC = () => {
  const { boxes, isAuthenticated, user, openAuthModal, setView } = useGame();
  const [trustImageUrl, setTrustImageUrl] = useState('');

  const freeSignupBox = useMemo(() => boxes.find((box) => box.isDaily) ?? null, [boxes]);
  const hasClaimedFreeBox = Boolean(user.lastFreeBoxClaim);

  const showcaseItems = useMemo(
    () =>
      boxes
        .filter((box) => getBoxTags(box).includes('pokemon'))
        .flatMap((box) =>
          box.items.map((item) => ({
            ...item,
            showcaseId: `${box.id}-${item.id}`
          }))
        )
        .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
        .slice(0, 12),
    [boxes]
  );

  const handleGetFreeBox = () => {
    if (!freeSignupBox) return;

    if (isAuthenticated) {
      setView({ type: 'CASE_OPENING', boxId: freeSignupBox.id, isFree: true });
      return;
    }

    trackEvent('signup_cta_clicked', { placement: 'spin_landing' });
    setPostSignupRedirect('/case/free-box');
    openAuthModal('register');
  };

  useEffect(() => {
    trackEvent('free_box_page_viewed', { page: '/spin' });

    const unsubscribe = subscribeHomepageConfig(
      (config) => {
        setTrustImageUrl(config?.trustImageUrl ?? '');
      },
      () => {
        setTrustImageUrl('');
      }
    );

    return () => unsubscribe();
  }, []);

  const hasPrizeItems = showcaseItems.length > 0;
  const carouselItems = hasPrizeItems ? [...showcaseItems, ...showcaseItems] : [];

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#14191f] px-3 py-6 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(125,211,252,0.18),transparent_32%),radial-gradient(circle_at_14%_28%,rgba(217,70,239,0.12),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(251,191,36,0.14),transparent_24%),linear-gradient(180deg,#182027_0%,#11161b_100%)]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-300/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-[-8rem] h-72 w-72 rounded-full bg-fuchsia-400/[0.08] blur-3xl" />
      {SPARKLE_DOTS.map((classes, index) => (
        <span
          key={classes}
          className={`pointer-events-none absolute rounded-full shadow-[0_0_24px_currentColor] motion-safe:animate-[spinLandingFloat_4s_ease-in-out_infinite] ${classes}`}
          style={{ animationDelay: `${index * 0.55}s` }}
          aria-hidden="true"
        />
      ))}

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.055] px-4 py-9 text-center shadow-[0_24px_90px_rgba(5,8,12,0.48)] backdrop-blur sm:rounded-[2rem] sm:px-8 sm:py-14">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-300/10 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">New User Bonus</p>
          <h1 className="mt-3 text-balance text-4xl font-black leading-tight text-white sm:text-6xl">First Pull On Us</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-lg">
            Create your account and unlock your free mystery box instantly.
          </p>

          <div className="relative mx-auto mt-6 max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black/25 px-3 py-4 shadow-[inset_0_0_38px_rgba(125,211,252,0.06)] sm:mt-8 sm:px-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#1b2024] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#1b2024] to-transparent" />
            <div className={hasPrizeItems ? 'flex w-max gap-3 pb-1 pt-1 motion-safe:animate-[spinLandingMarquee_24s_linear_infinite] hover:[animation-play-state:paused] sm:gap-4' : 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pt-1 sm:gap-4'}>
              {hasPrizeItems
                ? carouselItems.map((item, index) => (
                    <article
                      key={`${item.showcaseId}-${index}`}
                      className="group w-[132px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.065] p-2.5 shadow-[0_10px_26px_rgba(5,8,12,0.22)] transition duration-300 hover:-translate-y-1 hover:scale-[1.025] hover:border-cyan-200/35 hover:shadow-[0_18px_36px_rgba(34,211,238,0.13)] sm:w-[164px] sm:p-3"
                    >
                      <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl bg-black/25 p-2 sm:h-28">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.16),transparent_44%)] opacity-70" />
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="relative z-10 mx-auto h-20 w-20 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-110 sm:h-24 sm:w-24"
                          />
                        ) : (
                          <div className="h-20 w-20 animate-pulse rounded-lg bg-white/[0.06] sm:h-24 sm:w-24" aria-hidden="true" />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-center text-xs font-semibold text-white sm:text-sm">{item.name}</p>
                    </article>
                  ))
                : Array.from({ length: PRIZE_SKELETON_COUNT }).map((_, index) => (
                    <article
                      key={`prize-skeleton-${index}`}
                      className="min-w-[136px] snap-start rounded-2xl border border-white/5 bg-[#252c32] p-3 sm:min-w-[164px]"
                      aria-hidden="true"
                    >
                      <div className="h-24 animate-pulse rounded-xl bg-white/[0.06] sm:h-28" />
                      <div className="mx-auto mt-3 h-3 w-4/5 animate-pulse rounded-full bg-white/[0.06]" />
                      <div className="mx-auto mt-2 h-3 w-3/5 animate-pulse rounded-full bg-white/[0.045]" />
                    </article>
                  ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGetFreeBox}
            disabled={!freeSignupBox || hasClaimedFreeBox}
            className="mt-6 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-cyan-200 via-white to-amber-100 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#14191f] shadow-[0_14px_34px_rgba(34,211,238,0.16)] transition hover:scale-[1.015] hover:shadow-[0_18px_42px_rgba(251,191,36,0.18)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Open My Free Box
          </button>

          {trustImageUrl.trim() && (
            <img
              src={trustImageUrl.trim()}
              alt="Trusted by players"
              loading="lazy"
              className="mx-auto mt-4 max-h-12 w-auto max-w-[220px] object-contain opacity-90 sm:max-h-14 sm:max-w-xs"
            />
          )}

          <p className="mt-3 text-xs text-slate-300 sm:text-sm">No purchase required • Real items • Instant pull</p>

          {(hasClaimedFreeBox || !freeSignupBox) && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-white/[0.06] bg-[#252c32] px-4 py-2 text-xs text-slate-300 sm:text-sm">
              {hasClaimedFreeBox
                ? 'You already claimed your signup free box on this account.'
                : 'No free signup box is configured yet. Please check back shortly.'}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_14px_38px_rgba(5,8,12,0.24)] backdrop-blur sm:p-6">
          <h2 className="text-center text-xl font-bold text-white sm:text-2xl">How It Works</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: User, step: 'Step 1', text: 'Create Account' },
              { icon: Gift, step: 'Step 2', text: 'Open My Free Box' },
              { icon: Sparkles, step: 'Step 3', text: 'Open & Win Real Items' }
            ].map((item) => (
              <article
                key={item.step}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center shadow-[0_0_0_rgba(0,0,0,0)] transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:shadow-[0_12px_26px_rgba(5,8,12,0.28)]"
              >
                <item.icon className="mx-auto h-5 w-5 text-slate-300" />
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">{item.step}</p>
                <p className="mt-1 text-sm font-medium text-white">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        @keyframes spinLandingMarquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }

        @keyframes spinLandingFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .55; }
          50% { transform: translate3d(0, -14px, 0) scale(1.35); opacity: 1; }
        }
      `}</style>
    </section>
  );
};
