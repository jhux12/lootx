import React, { useMemo } from 'react';
import { ArrowRight, Box, CheckCircle2, PackageCheck, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { MysteryBox } from '../types';
import { useGame } from '../context/GameContext';
import { trackEvent } from '../utils/trackEvent';

type HowItWorksProps = { boxes: MysteryBox[] };

const trustFeatures = [
  { label: 'Published box odds', Icon: ShieldCheck },
  { label: 'Instant inventory', Icon: PackageCheck },
  { label: 'Real collectible items', Icon: CheckCircle2 },
  { label: 'Tracked shipping', Icon: Truck }
];

export const HowItWorksSection: React.FC<HowItWorksProps> = ({ boxes }) => {
  const { setView } = useGame();
  const boxImages = useMemo(() => boxes.filter((box) => Boolean(box.image)).slice(0, 3), [boxes]);
  const revealItem = useMemo(() => boxes.flatMap((box) => box.items).find((item) => Boolean(item.image)) ?? null, [boxes]);
  const explore = () => { trackEvent('HomepageHowItWorksExploreBoxes', { placement: 'how_it_works' }); setView({ type: 'BOXES' }); };
  const fairness = () => { trackEvent('HomepageHowItWorksFairnessClicked', { placement: 'how_it_works' }); setView({ type: 'PROVABLY_FAIR' }); };
  return <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-24 px-3 pb-7 pt-7 sm:px-0 sm:pb-9 sm:pt-8">
    <header className="mx-auto max-w-2xl text-center"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-200/80">How it works</p><h2 id="how-it-works-title" className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Open. Reveal. Collect.</h2><p className="mt-3 text-sm leading-6 text-slate-400">Choose a box, reveal a real item, then keep it, sell it back, or request delivery.</p></header>
    <div className="relative mx-auto mt-7 grid max-w-6xl gap-3 md:grid-cols-3 md:gap-5">
      <div className="pointer-events-none absolute left-6 top-12 bottom-12 w-px bg-gradient-to-b from-sky-400/10 via-violet-400/50 to-sky-400/10 md:left-[16.6%] md:right-[16.6%] md:top-1/2 md:bottom-auto md:h-px md:w-auto md:bg-gradient-to-r" aria-hidden="true" />
      <HowItWorksStep number="01" title="Choose a box" description="Explore Pokémon cards, graded slabs, electronics, and limited collectible boxes." label="New boxes added regularly">
        <div className="relative h-20" aria-label="A selection of Pullz collectible boxes">{boxImages.map((box, index) => <img key={box.id} src={box.image} alt={`${box.name} collectible box`} width={110} height={110} loading="lazy" decoding="async" className="absolute bottom-0 h-20 w-20 object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.45)]" style={{ left: `${index * 29 + 8}%`, transform: `rotate(${index === 1 ? 3 : index === 2 ? 8 : -7}deg)` }} />)}{!boxImages.length && <Box className="mx-auto h-12 w-12 text-sky-200/60" aria-hidden="true" />}</div>
      </HowItWorksStep>
      <HowItWorksStep number="02" title="Reveal your pull" description="Open your box and watch your item appear directly in your Pullz inventory." label={<button type="button" onClick={fairness} className="underline decoration-sky-300/40 underline-offset-4 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80">Published odds on every box</button>}>
        <div className="relative mx-auto flex h-20 max-w-[180px] items-center justify-center overflow-hidden rounded-xl border border-violet-300/20 bg-[#0c1424]"><div className="absolute h-14 w-24 rounded-full bg-violet-400/20 blur-xl" />{revealItem?.image ? <img src={revealItem.image} alt={`${revealItem.name} collectible item`} width={80} height={80} loading="lazy" decoding="async" className="relative z-10 h-16 w-16 object-contain drop-shadow-[0_8px_10px_rgba(124,92,255,0.45)]" /> : <Sparkles className="relative z-10 h-10 w-10 text-violet-200" />}<span className="absolute right-2 top-2 rounded bg-violet-400/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-violet-100">Reveal</span></div>
      </HowItWorksStep>
      <HowItWorksStep number="03" title="Keep, sell, or ship" description="Hold the item in your inventory, sell it back for coins, or request delivery to your door." label="Tracked delivery for shipped items">
        <div className="mx-auto grid h-20 max-w-[180px] grid-cols-3 gap-1.5 rounded-xl border border-sky-300/15 bg-[#0c1424] p-2"><MiniAction label="Keep" className="bg-emerald-400/15 text-emerald-200" /><MiniAction label="Sell back" className="bg-violet-400/15 text-violet-200" /><MiniAction label="Ship" className="bg-sky-400/15 text-sky-200" /></div>
      </HowItWorksStep>
    </div>
    <div className="mx-auto mt-5 flex max-w-5xl flex-wrap justify-center gap-x-5 gap-y-2 rounded-xl border border-[#2a3b58] bg-[#101827]/70 px-4 py-3">{trustFeatures.map(({ label, Icon }) => <span key={label} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-300"><Icon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />{label}</span>)}</div>
    <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row"><button type="button" onClick={explore} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(32,93,215,0.30)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 sm:w-auto">Explore boxes<ArrowRight className="h-4 w-4" /></button><button type="button" onClick={fairness} className="inline-flex min-h-11 items-center justify-center px-3 text-xs font-black uppercase tracking-wide text-sky-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80">Learn about fairness</button></div>
  </section>;
};

const HowItWorksStep: React.FC<{ number: string; title: string; description: string; label: React.ReactNode; children: React.ReactNode }> = ({ number, title, description, label, children }) => <article className="group relative min-h-[232px] overflow-hidden rounded-2xl border border-[#2a3b58] bg-[#101827] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-1 hover:border-sky-300/45 hover:shadow-[0_15px_32px_rgba(32,93,215,0.16)] motion-reduce:transform-none"><span className="pointer-events-none absolute right-3 top-1 text-6xl font-black leading-none text-white/[0.045]" aria-hidden="true">{number}</span><div className="relative z-10"><span className="text-[10px] font-black tracking-[0.2em] text-sky-200/80">{number}</span><h3 className="mt-1 text-lg font-black text-white">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-400">{description}</p><div className="mt-3">{children}</div><div className="mt-3 text-[10px] font-bold text-slate-300">{label}</div></div></article>;
const MiniAction: React.FC<{ label: string; className: string }> = ({ label, className }) => <div className={`flex items-center justify-center rounded-md px-1 text-center text-[7px] font-black uppercase leading-3 ${className}`}>{label}</div>;
