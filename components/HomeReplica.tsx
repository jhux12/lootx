import React, { useMemo, useState } from 'react';
import { ArrowRight, Box, CheckCircle2, ChevronDown, PackageCheck, ShieldCheck, Sparkles, Truck, Users, Zap } from 'lucide-react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
  trendingBoxIds?: string[];
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

type FeaturedBox = MysteryBox & { topPull?: MysteryBox['items'][number] };

const TRUST_ITEMS = [
  { label: 'Real Items', icon: PackageCheck },
  { label: 'Provably Fair', icon: ShieldCheck },
  { label: 'Fast Shipping', icon: Truck },
  { label: 'Instant Sellback', icon: Zap }
];

const STATIC_TRUST = ['Real inventory', 'Verified openings', 'Tracked shipping', 'Secure payments'];

const HOW_IT_WORKS = [
  { title: 'Choose a Box', copy: 'Browse Pokémon boxes at different price points.', icon: Box },
  { title: 'Open Instantly', copy: 'Reveal a real collectible immediately.', icon: Sparkles },
  { title: 'Ship or Sell Back', copy: 'Keep your item, ship it, or exchange it for coins.', icon: Truck }
];

const WHY_PULLZ = [
  { title: 'Real Inventory', copy: 'Every prize represents a real collectible.', icon: PackageCheck },
  { title: 'Provably Fair', copy: 'Openings use a verifiable fairness system.', icon: ShieldCheck },
  { title: 'Instant Openings', copy: 'No waiting for breaks, auctions, or group fills.', icon: Zap },
  { title: 'Built for Collectors', copy: 'Focused on Pokémon cards, slabs, and collectible ownership.', icon: Users }
];

const FAQS = [
  { q: 'Are the cards and items real?', a: 'Yes. Pullz.gg boxes are tied to real collectible inventory, and eligible items can be managed from your account inventory after opening.' },
  { q: 'Can I ship everything I win?', a: 'Eligible physical collectibles can be requested for shipment from your inventory. Any item-specific restrictions or account requirements are shown in the shipping flow.' },
  { q: 'Can I sell items back?', a: 'Eligible items can be exchanged back for coins instantly from the inventory experience when sellback is available for that item.' },
  { q: 'How long does shipping take?', a: 'Shipping timing depends on the item, destination, and fulfillment status. Use the shipping policy and your account shipment view for current details.' },
  { q: 'How does provably fair work?', a: 'Pullz.gg provides a provably fair system so openings can be verified instead of relying on hidden results.' },
  { q: 'How does the free first pull work?', a: 'Create an account and follow the existing first-pull flow. Any eligibility details are handled by the current signup and free-box experience.' }
];

const FOOTER_LINKS = [
  ['Open Boxes', '/boxes'],
  ['How It Works', '#how-it-works'],
  ['Shipping Policy', '/shipping'],
  ['Refund Policy', '/refund'],
  ['Terms of Service', '/terms'],
  ['Privacy Policy', '/privacy'],
  ['Contact', '/contact'],
  ['FAQ', '/faq']
];

const getTopPull = (box: MysteryBox) =>
  [...(box.items || [])].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];

const handleSmoothScroll = (id: string) => {
  const element = document.getElementById(id);
  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const SectionHeader = ({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) => (
  <div className="mx-auto mb-7 max-w-3xl text-center sm:mb-10">
    {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-purple-300">{eyebrow}</p> : null}
    <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">{title}</h2>
    {copy ? <p className="mt-3 text-base leading-7 text-slate-300 sm:text-lg">{copy}</p> : null}
  </div>
);

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, demoBoxId, trendingBoxIds = [], onOpenBox, onViewAllBoxes, onSignUp }) => {
  const [openFaq, setOpenFaq] = useState(0);

  const featuredBoxes = useMemo<FeaturedBox[]>(() => {
    const orderedIds = [demoBoxId, ...trendingBoxIds].filter(Boolean) as string[];
    const preferred = orderedIds.map((id) => boxes.find((box) => box.id === id)).filter(Boolean) as MysteryBox[];
    const remaining = boxes.filter((box) => !preferred.some((entry) => entry.id === box.id));
    return [...preferred, ...remaining].slice(0, 6).map((box) => ({ ...box, topPull: getTopPull(box) }));
  }, [boxes, demoBoxId, trendingBoxIds]);

  const heroBox = featuredBoxes[0];
  const heroPulls = useMemo(() => {
    const pool = boxes.flatMap((box) => (box.items || []).filter((item) => item.image).map((item) => ({ ...item, boxName: box.name })));
    return pool.sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 3);
  }, [boxes]);

  const proofItems = useMemo(() => {
    const visualPool = boxes.flatMap((box) => (box.items || []).filter((item) => item.image).map((item) => ({ ...item, boxName: box.name })));
    return visualPool.sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 8);
  }, [boxes]);

  return (
    <div className="pullz-home-shell min-h-screen overflow-hidden bg-[#050509] text-white selection:bg-purple-500/40">
      <section className="relative isolate px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_22%,rgba(126,34,206,0.32),transparent_34%),radial-gradient(circle_at_20%_10%,rgba(88,28,135,0.2),transparent_28%),linear-gradient(180deg,#050509_0%,#090713_55%,#050509_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl lg:max-w-2xl">
            <p className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.22em] text-purple-200">REAL COLLECTIBLES. REAL SHIPMENTS.</p>
            <h1 className="text-[2.6rem] font-black leading-[0.95] tracking-[-0.06em] text-white min-[375px]:text-5xl sm:text-6xl lg:text-7xl xl:text-[4.75rem]">
              Open Boxes.<br />Win <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent">Real Pokémon Cards.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Every pull is a real collectible you can ship to your door or sell back instantly. Open your first box free and see how Pullz.gg works.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onSignUp} className="min-h-12 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-violet-600 px-6 py-3 text-base font-black text-white shadow-[0_0_32px_rgba(168,85,247,0.35)] transition hover:scale-[1.02] hover:shadow-[0_0_42px_rgba(168,85,247,0.48)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">Open Your First Box</button>
              <button type="button" onClick={() => handleSmoothScroll('how-it-works')} className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3 text-base font-bold text-white transition hover:border-purple-300/50 hover:bg-purple-400/10 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">How It Works</button>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TRUST_ITEMS.map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-slate-200"><Icon className="h-4 w-4 text-purple-300" />{label}</div>)}
            </div>
          </div>

          <div className="relative mx-auto h-[430px] w-full max-w-[560px] sm:h-[560px]" aria-label="Pullz.gg box and graded Pokémon card display">
            <div className="absolute inset-6 rounded-full bg-purple-600/20 blur-3xl" />
            <div className="absolute bottom-16 left-1/2 h-16 w-72 -translate-x-1/2 rounded-full bg-purple-500/40 blur-2xl" />
            {heroPulls.map((item, index) => (
              <div key={`${item.id}-${index}`} className={`home-float absolute rounded-[1.6rem] border border-white/12 bg-slate-950/80 p-3 shadow-2xl backdrop-blur ${index === 0 ? 'left-0 top-16 w-36 rotate-[-10deg] sm:w-44' : index === 1 ? 'right-1 top-8 w-32 rotate-[9deg] sm:w-40' : 'right-10 bottom-24 w-32 rotate-[14deg] sm:w-40'}`} style={{ animationDelay: `${index * 0.8}s` }}>
                <img src={item.image} alt={`${item.name} collectible`} className="aspect-[3/4] w-full rounded-2xl object-contain" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
                <p className="mt-2 truncate text-xs font-bold text-slate-200">{item.name}</p>
              </div>
            ))}
            <div className="home-float absolute left-1/2 top-1/2 w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-purple-300/20 bg-gradient-to-br from-[#15111f] via-[#09080d] to-black p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:w-[330px]">
              <div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.28),transparent_58%),#08070b] p-8 text-center">
                {heroBox?.image ? <img src={heroBox.image} alt={`${heroBox.name} box`} className="mx-auto h-44 w-44 object-contain drop-shadow-[0_28px_32px_rgba(0,0,0,0.55)] sm:h-56 sm:w-56" loading="eager" decoding="async" /> : <Box className="mx-auto h-40 w-40 text-purple-300" />}
                <p className="mt-5 text-xl font-black tracking-tight">Pullz.gg</p>
                <p className="text-sm font-semibold text-purple-200">Premium Pokémon Pull Box</p>
              </div>
            </div>
            <span className="home-particle left-[12%] top-[10%]" /><span className="home-particle right-[18%] top-[38%]" /><span className="home-particle bottom-[18%] left-[24%]" />
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl"><h2 className="text-center text-2xl font-black sm:text-3xl">Built for Pokémon Collectors</h2><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{STATIC_TRUST.map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-sm font-bold text-slate-200 sm:text-base"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-purple-300" />{item}</div>)}</div></div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8" id="featured-boxes">
        <div className="mx-auto max-w-7xl"><SectionHeader title="Choose Your Next Box" />
          {featuredBoxes.length ? <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">{featuredBoxes.map((box) => <article key={box.id} className="min-w-[82vw] snap-center rounded-[1.75rem] border border-white/10 bg-[#0d0b14] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:min-w-0"><div className="grid min-h-48 place-items-center rounded-[1.35rem] bg-[radial-gradient(circle_at_50%_20%,rgba(147,51,234,.25),transparent_55%),#08070b]"><img src={box.image} alt={`${box.name} box`} className="h-40 w-40 object-contain" loading="lazy" decoding="async" /></div><div className="pt-5"><h3 className="text-xl font-black text-white">{box.name}</h3><CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} className="mt-2 font-bold text-purple-100" iconClassName="h-4 w-4" /><p className="mt-3 min-h-12 text-sm leading-6 text-slate-300">Open this box for a real Pokémon collectible from Pullz.gg inventory.</p>{box.topPull ? <p className="mt-3 truncate rounded-xl border border-purple-300/15 bg-purple-400/10 px-3 py-2 text-sm font-semibold text-purple-100">Top possible pull: {box.topPull.name}</p> : null}<button type="button" onClick={() => onOpenBox(box.id)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-black transition hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">Open Box <ArrowRight className="h-4 w-4" /></button></div></article>)}</div> : <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">Boxes are loading. You can still browse the full box catalog.</div>}
          <div className="mt-8 text-center"><button onClick={onViewAllBoxes} className="rounded-2xl border border-white/15 px-5 py-3 font-bold text-white hover:bg-white/10">View all boxes</button></div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title="Three Steps to Your Next Pull" /> <div className="grid gap-4 md:grid-cols-3">{HOW_IT_WORKS.map(({ title, copy, icon: Icon }, index) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200"><Icon /></div><p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">Step {index + 1}</p><h3 className="mt-2 text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-300">{copy}</p></article>)}</div></div></section>

      <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title="Real Wins. Real Deliveries." copy="A collector-focused look at real Pullz.gg pulls and shipment-ready collectibles." />{proofItems.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{proofItems.map((item, index) => <figure key={`${item.id}-${index}`} className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b14]"><div className="grid aspect-square place-items-center bg-black/30 p-4"><img src={item.image} alt={`${item.name} collectible pull`} className="h-full w-full object-contain" loading="lazy" decoding="async" /></div><figcaption className="p-3"><span className="rounded-full bg-purple-400/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-wider text-purple-200">{index % 4 === 0 ? 'Recently Pulled' : index % 4 === 1 ? 'Recently Shipped' : index % 4 === 2 ? 'Community Win' : 'Delivered'}</span><p className="mt-2 truncate text-sm font-bold">{item.name}</p></figcaption></figure>)}</div> : <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">Community pull images will appear here as inventory and shipment media become available.</div>}</div></section>

      <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title="Why Pullz.gg" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{WHY_PULLZ.map(({ title, copy, icon: Icon }) => <article key={title} className="rounded-3xl border border-white/10 bg-[#0d0b14] p-6"><Icon className="h-7 w-7 text-purple-300" /><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p></article>)}</div></div></section>

      <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl rounded-[2rem] border border-purple-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.28),transparent_58%),#0b0711] p-7 text-center shadow-[0_28px_80px_rgba(88,28,135,.24)] sm:p-12"><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Your First Pull Is Free</h2><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">Create your account, open your first box, and experience Pullz.gg without purchasing coins first.</p><button type="button" onClick={onSignUp} className="mt-7 min-h-12 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-violet-600 px-7 py-3 font-black text-white shadow-[0_0_32px_rgba(168,85,247,0.35)]">Claim My Free Pull</button></div></section>

      <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><SectionHeader title="FAQ" /> <div className="space-y-3">{FAQS.map((faq, index) => { const isOpen = openFaq === index; return <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.035]"><button type="button" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? -1 : index)} className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-300">{faq.q}<ChevronDown className={`h-5 w-5 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen ? <p className="px-5 pb-5 leading-7 text-slate-300">{faq.a}</p> : null}</div>; })}</div></div></section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between"><div><p className="text-2xl font-black">Pullz.gg</p><p className="mt-2 text-sm text-slate-400">Premium Pokémon collectible boxes.</p></div><nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-300" aria-label="Footer navigation">{FOOTER_LINKS.map(([label, href]) => <a key={label} href={href} className="hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300">{label}</a>)}</nav><div className="flex gap-3 text-sm font-bold text-slate-300"><a href="https://x.com/pullzgg" className="hover:text-white">X</a><a href="https://www.instagram.com/pullzgg" className="hover:text-white">Instagram</a><a href="https://discord.gg/pullz" className="hover:text-white">Discord</a></div></div></footer>
    </div>
  );
};
