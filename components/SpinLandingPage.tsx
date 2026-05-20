import React, { useEffect, useMemo } from 'react';
import { Gift, ShieldCheck, Sparkles, User, Zap } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { setPostSignupRedirect } from '../utils/postSignupRedirect';
import { trackEvent } from '../utils/trackEvent';

const REWARD_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/boxes%2Fu%20(4).png?alt=media&token=2bb02e25-aad4-45b7-b406-46a189ee6f34';

export const SpinLandingPage: React.FC = () => {
  const { boxes, items, isAuthenticated, user, openAuthModal, setView } = useGame();

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
  }, []);

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#1b2024] px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(32,93,215,0.14),transparent_46%),radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.10),transparent_56%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">

        <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#20262b] px-4 py-10 text-center shadow-[0_14px_38px_rgba(5,8,12,0.22)] sm:px-8 sm:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.18),transparent_56%),radial-gradient(circle_at_25%_15%,rgba(32,93,215,0.12),transparent_46%)]" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">New User Bonus</p>
            <h1 className="mt-3 text-balance text-4xl font-black leading-tight text-white sm:text-6xl">First Pull On Us</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-lg">
              Create your account and unlock your free mystery box instantly.
            </p>

            <button
              type="button"
              onClick={handleGetFreeBox}
              disabled={!freeSignupBox || hasClaimedFreeBox}
              className="mt-6 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-300 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Get Free Box
            </button>

            <p className="mt-3 text-xs text-slate-400 sm:text-sm">No purchase required • Real items • Instant pull</p>

            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-xs text-blue-100 sm:text-sm">
              {hasClaimedFreeBox
                ? 'You already claimed your signup free box on this account.'
                : freeSignupBox
                  ? 'Your free signup box is waiting — tap get free box to continue.'
                  : 'No free signup box is configured yet. Please check back shortly.'}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#20262b] p-4 shadow-[0_14px_38px_rgba(5,8,12,0.22)] sm:p-6">
          <h2 className="text-center text-xl font-black uppercase tracking-[0.1em] text-slate-100 sm:text-2xl">Free Box Showcase</h2>
          <div className="mx-auto mt-4 max-w-sm rounded-xl border border-white/5 bg-[#21282c] p-5 text-center shadow-[0_14px_38px_rgba(5,8,12,0.22)]">
            <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
              <div className="absolute inset-0 rounded-full bg-cyan-300/20 blur-2xl animate-[softPulse_3s_ease-in-out_infinite]" />
              <img src={REWARD_IMAGE} alt="Free signup box" className="relative z-10 h-full w-full object-contain" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-100">Free Signup Box</h3>
            <p className="mt-1 text-sm text-slate-400">Available instantly after signup</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#20262b] p-4 shadow-[0_14px_38px_rgba(5,8,12,0.22)] sm:p-6">
          <h2 className="text-center text-xl font-black uppercase tracking-[0.1em] text-slate-100 sm:text-2xl">How It Works</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: User, step: 'Step 1', text: 'Create Account' },
              { icon: Gift, step: 'Step 2', text: 'Get Free Box' },
              { icon: Sparkles, step: 'Step 3', text: 'Open & Win Real Items' }
            ].map((item) => (
              <article
                key={item.step}
                className="rounded-xl border border-white/5 bg-[#21282c] p-4 text-center transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_12px_28px_rgba(5,8,12,0.45)]"
              >
                <item.icon className="mx-auto h-5 w-5 text-cyan-200" />
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.step}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-center text-xl font-black uppercase tracking-[0.1em] text-slate-100 sm:text-2xl">What You Can Win</h2>
          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#1b2024] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#1b2024] to-transparent" />
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory sm:gap-4">
              {(topItems.length ? topItems : [{ id: 'free-signup-box', name: 'Free Signup Box', image: REWARD_IMAGE }]).map((item) => (
                <article
                  key={item.id}
                  className="group min-w-[150px] snap-start overflow-hidden rounded-xl border border-white/5 bg-[#21282c] p-3 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_12px_28px_rgba(5,8,12,0.45)] sm:min-w-[180px]"
                >
                  <div className="rounded-lg bg-black/20 p-2">
                    <img
                      src={item.image || REWARD_IMAGE}
                      alt={item.name}
                      loading="lazy"
                      className="mx-auto h-20 w-20 object-contain transition-transform duration-300 group-hover:scale-105 sm:h-24 sm:w-24"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-center text-xs font-semibold text-slate-100 sm:text-sm">{item.name}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Gift, title: 'Real Rewards', text: 'Win authentic items' },
            { icon: Zap, title: 'Instant Delivery', text: 'Ship or sell instantly' },
            { icon: ShieldCheck, title: 'Provably Fair', text: 'Transparent odds' }
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-white/5 bg-[#21282c] p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_12px_28px_rgba(5,8,12,0.45)]"
            >
              <card.icon className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-3 text-base font-semibold text-slate-100">{card.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{card.text}</p>
            </article>
          ))}
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#21282c] p-6 text-center shadow-[0_14px_38px_rgba(5,8,12,0.22)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.20),transparent_56%),radial-gradient(circle_at_25%_15%,rgba(32,93,215,0.15),transparent_46%)]" />
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white sm:text-3xl">Your First Pull Is Waiting</h2>
            <button
              type="button"
              onClick={() => {
                trackEvent('signup_cta_clicked', { placement: 'spin_landing_footer' });
                setPostSignupRedirect('/case/free-box');
                openAuthModal('register');
              }}
              className="mt-4 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-300 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 active:scale-[0.99]"
            >
              Get Free Box
            </button>
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
