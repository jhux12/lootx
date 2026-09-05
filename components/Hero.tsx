import React from 'react';
import heroImage from '../assets/hero.png';
import pullzPattern from '../assets/png/pullz-icon-color-2048.png';
import { useGame } from '../context/GameContext';
import { setPostSignupRedirect } from '../utils/postSignupRedirect';
import { trackEvent } from '../utils/trackEvent';

export const Hero: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      trackEvent('signup_cta_clicked', { placement: 'hero' });
      setPostSignupRedirect('/case/free-box');
      openAuthModal('register');
      return;
    }
    scrollToSection('popular-boxes');
  };

  return (
    <section className="pullz-cls-hero group relative w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#060910] px-5 py-7 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <div className="pointer-events-none absolute inset-0 rounded-[28px]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,#131f42_0%,#090d18_45%,#05070d_100%)]" />
        <div className="absolute inset-0 opacity-20 mix-blend-screen animate-hero-drift" style={{ backgroundImage: `url(${pullzPattern})`, backgroundSize: '260px 260px' }} />
        <div className="absolute -left-28 top-[-14%] h-[500px] w-[500px] rounded-full bg-[#2563ff]/20 blur-[120px]" />
        <div className="absolute -right-24 top-[-10%] h-[460px] w-[460px] rounded-full bg-sky-500/22 blur-[120px]" />
        <div className="absolute right-[14%] top-[20%] h-[380px] w-[380px] rounded-full bg-blue-500/25 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(3,6,12,0.65)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[500px] max-w-6xl gap-8 lg:min-h-[620px] lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-5 sm:space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-100 shadow-[0_0_24px_rgba(94,92,230,0.35)] backdrop-blur-md sm:text-xs">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#205DD7]/90 to-sky-500/90 text-white shadow-[0_0_14px_rgba(32,93,215,0.65)]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path d="M12 3l7 3v5c0 4.4-2.98 8.5-7 9.5-4.02-1-7-5.1-7-9.5V6l7-3z" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8.5 12.2l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-white/90">Provably Fair</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]" />
            <span className="text-emerald-300">Verified</span>
          </div>

          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-black uppercase tracking-tight text-white sm:text-5xl sm:leading-[0.95] lg:text-7xl lg:leading-[0.92]">
              Fair Value <span className="block bg-gradient-to-r from-[#205DD7] via-blue-400 to-sky-300 bg-clip-text text-transparent">Guarantee</span>
            </h1>
            <p className="max-w-xl text-sm font-medium uppercase tracking-[0.15em] text-slate-300 sm:text-base">
              Discover, open &amp; collect on Ripza.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-300 sm:text-sm">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />Provably Fair</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" />Real Items</span>
            <span className="hidden items-center gap-2 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-sky-300" />Instant Payouts</span>
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-400 px-7 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white shadow-[0_16px_45px_-20px_rgba(32,93,215,0.9)] transition duration-300 hover:brightness-110 hover:shadow-[0_20px_55px_-24px_rgba(32,93,215,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
            >
              Sign Up &amp; Get Free Pack
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-black/20 px-7 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-100 transition hover:border-blue-300/50 hover:bg-white/10"
            >
              Learn More
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[300px] items-end justify-center pt-4 sm:min-h-[390px] lg:min-h-[520px] lg:pt-0">
          <div className="pointer-events-none absolute inset-x-[14%] top-[18%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.45)_0%,rgba(147,51,234,0.25)_40%,rgba(0,0,0,0)_72%)] blur-2xl animate-hero-pulse" />
          <div className="pointer-events-none absolute inset-x-[18%] top-[25%] h-[45%] rounded-full border border-cyan-300/20 blur-sm" />
          <img
            src={heroImage}
            className="relative z-10 h-[280px] w-auto max-w-full object-contain drop-shadow-[0_8px_20px_rgba(34,211,238,0.3)] sm:h-[360px] lg:h-[500px] animate-hero-float"
            alt="Ripza hero"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            width={960}
            height={960}
            style={{
              aspectRatio: '1 / 1',
              filter: 'drop-shadow(0 0 24px rgba(32,93,215,0.35)) drop-shadow(0 0 60px rgba(236,72,153,0.2))'
            }}
          />
          <div className="pointer-events-none absolute bottom-[7%] left-1/2 h-10 w-[55%] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-2xl" />
        </div>
      </div>

      <style>{`
        @keyframes hero-drift {
          0% { transform: translate(-4%, -2%) scale(1); }
          50% { transform: translate(4%, 2%) scale(1.03); }
          100% { transform: translate(-4%, -2%) scale(1); }
        }
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes hero-pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .animate-hero-drift {
          animation: hero-drift 28s ease-in-out infinite;
        }
        .animate-hero-float {
          animation: hero-float 10s ease-in-out infinite;
        }
        .animate-hero-pulse {
          animation: hero-pulse 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};
