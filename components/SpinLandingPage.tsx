import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Sparkles, User } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { setPostSignupRedirect } from '../utils/postSignupRedirect';
import { trackEvent } from '../utils/trackEvent';
import { subscribeHomepageConfig } from '../utils/homepageShowcase';
import { getBoxTags } from '../utils/boxTags';

const PRIZE_SKELETON_COUNT = 6;

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

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#1b2024] px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,#1b2024_0%,#171b1f_100%)]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-white/[0.035] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">
        <section className="rounded-3xl border border-white/5 bg-[#20262b] px-4 py-10 text-center shadow-[0_24px_80px_rgba(5,8,12,0.35)] sm:px-8 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">New User Bonus</p>
          <h1 className="mt-3 text-balance text-4xl font-black leading-tight text-white sm:text-6xl">First Pull On Us</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-lg">
            Create your account and unlock your free mystery box instantly.
          </p>

          <div className="relative mx-auto mt-6 max-w-5xl overflow-hidden rounded-2xl border border-white/5 bg-[#1b2024] px-3 py-4 sm:mt-8 sm:px-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#1b2024] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#1b2024] to-transparent" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pt-1 sm:gap-4">
              {hasPrizeItems
                ? showcaseItems.map((item) => (
                    <article
                      key={item.showcaseId}
                      className="group min-w-[136px] snap-start rounded-2xl border border-white/5 bg-[#252c32] p-3 shadow-[0_10px_26px_rgba(5,8,12,0.18)] transition hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_14px_30px_rgba(5,8,12,0.32)] sm:min-w-[164px]"
                    >
                      <div className="flex h-24 items-center justify-center rounded-xl bg-black/20 p-2 sm:h-28">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="mx-auto h-20 w-20 object-contain transition-transform duration-300 group-hover:scale-105 sm:h-24 sm:w-24"
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
            className="mt-6 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#1b2024] shadow-[0_14px_34px_rgba(5,8,12,0.28)] transition hover:bg-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
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

        <section className="rounded-2xl border border-white/5 bg-[#20262b] p-4 shadow-[0_14px_38px_rgba(5,8,12,0.18)] sm:p-6">
          <h2 className="text-center text-xl font-bold text-white sm:text-2xl">How It Works</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: User, step: 'Step 1', text: 'Create Account' },
              { icon: Gift, step: 'Step 2', text: 'Open My Free Box' },
              { icon: Sparkles, step: 'Step 3', text: 'Open & Win Real Items' }
            ].map((item) => (
              <article
                key={item.step}
                className="rounded-2xl border border-white/5 bg-[#252c32] p-4 text-center shadow-[0_0_0_rgba(0,0,0,0)] transition hover:border-slate-400/35 hover:shadow-[0_12px_26px_rgba(5,8,12,0.28)]"
              >
                <item.icon className="mx-auto h-5 w-5 text-slate-300" />
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">{item.step}</p>
                <p className="mt-1 text-sm font-medium text-white">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

      </div>

    </section>
  );
};
