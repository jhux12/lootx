import React, { useState } from 'react';
import { ArrowRight, ImageOff } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { trackEvent } from '../utils/trackEvent';

const steps = [
  {
    number: '01',
    title: 'Choose Your Box',
    description: 'Browse boxes and select one based on the collectibles, price, and displayed odds.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/hiw%2Fhowitwork.png?alt=media&token=4da2e4ea-b001-4b2e-b1fd-7be8c1ff780d',
    alt: 'Pullz mystery boxes ready to choose'
  },
  {
    number: '02',
    title: 'Open & Reveal',
    description: 'Open the box for an animated reveal and instantly discover the real collectible you pulled.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/hiw%2Fhowitwork%20(1).png?alt=media&token=2f3488c5-5309-4f73-a882-863609967ace',
    alt: 'A collectible appearing during a Pullz box reveal'
  },
  {
    number: '03',
    title: 'Keep It or Sell It Back',
    description: 'Keep the item for shipping or instantly sell it back for coins to open another box.',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/hiw%2Fhowitwork%20(2).png?alt=media&token=7b8c55ce-0068-4f86-9d6f-03961851e5bd',
    alt: 'Pullz options to keep a collectible or sell it back'
  }
] as const;

export const HowItWorksSection: React.FC = () => {
  const { setView } = useGame();

  const browseBoxes = () => {
    trackEvent('HomepageHowItWorksExploreBoxes', { placement: 'how_it_works' });
    setView({ type: 'BOXES' });
    window.history.replaceState({}, '', '/boxes');
  };

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="relative isolate scroll-mt-24 overflow-hidden px-3 py-10 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:rounded-[28px] sm:border sm:border-white/[0.06] sm:px-6 sm:py-14 lg:px-10 lg:py-16"
    >
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(145deg,rgba(14,16,31,0.98),rgba(7,9,18,0.99))]" />
      <div className="pointer-events-none absolute -left-32 top-16 -z-10 h-72 w-72 rounded-full bg-fuchsia-600/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-80 w-80 rounded-full bg-cyan-400/[0.07] blur-3xl" />

      <header className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300 sm:text-xs">Three simple steps</p>
        <h2 id="how-it-works-title" className="mt-3 text-3xl font-black uppercase tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
          How It <span className="bg-gradient-to-r from-[#a78bfa] via-[#ec6dce] to-[#56d9f5] bg-clip-text text-transparent">Works</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">From choosing a box to owning a real collectible, every pull is fast and simple.</p>
      </header>

      <div className="relative mx-auto mt-8 grid max-w-6xl gap-4 md:mt-11 md:grid-cols-3 md:gap-5 lg:gap-7">
        <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-[9.5rem] hidden h-px bg-gradient-to-r from-violet-400/0 via-fuchsia-400/45 to-cyan-300/0 md:block" aria-hidden="true" />
        {steps.map((step, index) => <HowItWorksCard key={step.number} {...step} index={index} />)}
      </div>

      <div className="mt-8 flex justify-center sm:mt-10">
        <button
          type="button"
          onClick={browseBoxes}
          className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-[#7c3aed] via-[#a43fca] to-[#168bc2] px-7 py-3 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_30px_rgba(103,55,204,0.26)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_34px_rgba(103,55,204,0.34)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 motion-reduce:transform-none sm:w-auto"
        >
          Browse Boxes
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

type Step = (typeof steps)[number];

const HowItWorksCard: React.FC<Step & { index: number }> = ({ number, title, description, image, alt, index }) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <article className="group relative flex min-h-[400px] flex-col overflow-hidden rounded-[22px] border border-white/[0.09] bg-[linear-gradient(155deg,rgba(28,25,51,0.94),rgba(13,17,30,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-violet-300/35 hover:shadow-[0_22px_48px_rgba(38,23,82,0.34)] motion-reduce:transform-none">
      <div className="relative aspect-[16/11] shrink-0 overflow-hidden border-b border-white/[0.07] bg-[#0b0d18]">
        <div className={`absolute inset-0 animate-pulse bg-gradient-to-br from-violet-950/70 via-[#15162a] to-cyan-950/40 transition-opacity ${imageState === 'loading' ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
        {imageState !== 'error' ? (
          <img
            src={image}
            alt={alt}
            width={500}
            height={500}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageState('loaded')}
            onError={() => setImageState('error')}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.025] ${imageState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500" role="img" aria-label={`${alt} (image unavailable)`}>
            <ImageOff className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs font-bold">Preview unavailable</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111322]/55 via-transparent to-violet-400/[0.05]" />
      </div>

      <div className="relative flex flex-1 flex-col px-5 pb-6 pt-7 sm:px-6">
        <span className="absolute -top-6 left-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#8b5cf6] via-[#b642bc] to-[#159dcc] text-sm font-black text-white shadow-[0_8px_22px_rgba(124,58,237,0.35)] sm:left-6">{number}</span>
        <span className="absolute right-4 top-1 text-6xl font-black leading-none text-white/[0.025]" aria-hidden="true">{number}</span>
        <h3 className="relative mt-1 text-xl font-black tracking-tight text-white">{title}</h3>
        <p className="relative mt-3 text-sm leading-6 text-slate-400">{description}</p>
      </div>

      {index < steps.length - 1 && <span className="pointer-events-none absolute -bottom-3 left-1/2 z-20 grid h-7 w-7 -translate-x-1/2 rotate-90 place-items-center rounded-full border border-violet-300/25 bg-[#171426] text-violet-200 md:hidden" aria-hidden="true"><ArrowRight className="h-3.5 w-3.5" /></span>}
    </article>
  );
};
