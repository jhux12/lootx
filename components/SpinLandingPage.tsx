import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Sparkles, User } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { setPostSignupRedirect } from '../utils/postSignupRedirect';
import { trackEvent } from '../utils/trackEvent';
import { subscribeHomepageConfig } from '../utils/homepageShowcase';

const REWARD_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/boxes%2Fu%20(4).png?alt=media&token=2bb02e25-aad4-45b7-b406-46a189ee6f34';

export const SpinLandingPage: React.FC = () => {
  const { boxes, items, isAuthenticated, user, openAuthModal, setView } = useGame();
  const [trustImageUrl, setTrustImageUrl] = useState('');

  const freeSignupBox = useMemo(() => boxes.find((box) => box.isDaily) ?? null, [boxes]);
  const hasClaimedFreeBox = Boolean(user.lastFreeBoxClaim);

  const topItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
        .slice(0, 12),
    [items]
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

  const carouselItems = topItems.length
    ? topItems
    : [{ id: 'free-signup-box', name: 'Free Signup Box', image: REWARD_IMAGE }];

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_6%,rgba(32,93,215,0.3),transparent_40%),radial-gradient(circle_at_78%_0%,rgba(34,211,238,0.24),transparent_44%),radial-gradient(circle_at_50%_70%,rgba(59,130,246,0.15),transparent_42%),linear-gradient(180deg,#05070c_0%,#080b14_100%)]" />
      <div className="pointer-events-none absolute -top-36 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center shadow-[0_24px_100px_rgba(17,24,39,0.68)] backdrop-blur-2xl sm:px-8 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">New User Bonus</p>
          <h1 className="mt-3 text-balance text-4xl font-black leading-tight text-white sm:text-6xl">First Pull On Us</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 sm:text-lg">
            Create your account and unlock your free mystery box instantly.
          </p>

          <div className="relative mx-auto mt-6 max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#071020]/70 px-3 py-4 sm:mt-8 sm:px-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#071020] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#071020] to-transparent" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pt-1 sm:gap-4">
              {carouselItems.map((item) => (
                <article
                  key={item.id}
                  className="group min-w-[136px] snap-start rounded-2xl border border-cyan-300/10 bg-[#0b0e14] p-3 shadow-[0_0_18px_rgba(56,189,248,0.08)] transition hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_0_22px_rgba(56,189,248,0.22)] sm:min-w-[164px]"
                >
                  <div className="rounded-xl bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),rgba(34,211,238,0))] p-2">
                    <img
                      src={item.image || REWARD_IMAGE}
                      alt={item.name}
                      loading="lazy"
                      className="mx-auto h-20 w-20 object-contain transition-transform duration-300 group-hover:scale-105 sm:h-24 sm:w-24"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-center text-xs font-semibold text-white sm:text-sm">{item.name}</p>
                </article>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGetFreeBox}
            disabled={!freeSignupBox || hasClaimedFreeBox}
            className="mt-6 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-300 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
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

          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-xs text-blue-100 sm:text-sm">
            {hasClaimedFreeBox
              ? 'You already claimed your signup free box on this account.'
              : freeSignupBox
                ? 'Your free signup box is waiting — tap open my free box to continue.'
                : 'No free signup box is configured yet. Please check back shortly.'}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
          <h2 className="text-center text-xl font-bold text-white sm:text-2xl">How It Works</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: User, step: 'Step 1', text: 'Create Account' },
              { icon: Gift, step: 'Step 2', text: 'Open My Free Box' },
              { icon: Sparkles, step: 'Step 3', text: 'Open & Win Real Items' }
            ].map((item) => (
              <article
                key={item.step}
                className="rounded-2xl border border-white/10 bg-[#0b0e14] p-4 text-center shadow-[0_0_0_rgba(0,0,0,0)] transition hover:border-cyan-300/35 hover:shadow-[0_0_18px_rgba(56,189,248,0.22)]"
              >
                <item.icon className="mx-auto h-5 w-5 text-cyan-200" />
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">{item.step}</p>
                <p className="mt-1 text-sm font-medium text-white">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        @keyframes softPulse {
          0%,
          100% { opacity: 0.45; transform: scale(0.96); }
          50% { opacity: 0.95; transform: scale(1.06); }
        }
      `}</style>
    </section>
  );
};
