import React from 'react';
import heroImage from '../assets/hero.png';
import pullzPattern from '../assets/pullz-p.PNG';
import { Sparkles, ShieldCheck, Truck } from 'lucide-react';
import { useGame } from '../context/GameContext';

const featurePills = [
  { id: 'fair', label: 'Provably fair drops', icon: ShieldCheck },
  { id: 'instant', label: 'Instant sellback', icon: Sparkles },
  { id: 'shipping', label: 'Fast global shipping', icon: Truck }
];

export const Hero: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrimaryCta = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    scrollToSection('popular-boxes');
  };

  const handleSecondaryCta = () => {
    scrollToSection('how-it-works');
  };

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0f19] p-5 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${pullzPattern})`, backgroundSize: '320px 320px' }} />
        <div className="absolute -top-20 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-20 right-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div>
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
            Elevated homepage experience
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            A premium, app-style landing experience for your drops platform.
          </h1>

          <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
            Welcome users with a bold hero, polished social-proof messaging, and clear calls to action that feel modern on desktop and clean on mobile.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handlePrimaryCta}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-20px_rgba(139,92,246,0.95)] transition hover:translate-y-[-1px]"
            >
              Start opening cases
            </button>
            <button
              onClick={handleSecondaryCta}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Explore how it works
            </button>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {featurePills.map((pill) => {
              const Icon = pill.icon;
              return (
                <div key={pill.id} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b1322]/80 px-3 py-2 text-xs text-slate-200">
                  <Icon className="h-4 w-4 text-cyan-200" />
                  <span>{pill.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[500px]">
          <div className="rounded-[24px] border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02] p-4 backdrop-blur-sm sm:p-6">
            <img
              src={heroImage}
              className="h-[250px] w-full object-contain sm:h-[320px]"
              alt="Pullz.gg hero"
              loading="eager"
            />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2">
                <div className="text-lg font-bold text-white">24/7</div>
                <div className="text-[11px] text-slate-300">Live drops</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2">
                <div className="text-lg font-bold text-white">Fair</div>
                <div className="text-[11px] text-slate-300">Transparent odds</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2">
                <div className="text-lg font-bold text-white">Fast</div>
                <div className="text-[11px] text-slate-300">Instant actions</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
