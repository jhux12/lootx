import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Box, CheckCircle2, ChevronDown, CircleDot, ExternalLink, PackageCheck, ShieldCheck, Sparkles, Truck, Users, Zap } from 'lucide-react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { DEFAULT_HOMEPAGE_SETTINGS, HomepageActivityItem, HomepageSettings, loadHomepageSettings, loadPublicHomepageActivity } from '../utils/homepageContent';

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

type ChaseVisual = { label: string; imageUrl: string; imageAlt: string; secondaryImageUrl?: string; secondaryImageAlt?: string };

const TRUST_ICONS = { package: PackageCheck, shield: ShieldCheck, truck: Truck, check: CheckCircle2, users: Users, zap: Zap };

const TRUST_ITEMS = [
  { label: 'Real Items', icon: PackageCheck },
  { label: 'Provably Fair', icon: ShieldCheck },
  { label: 'Fast Shipping', icon: Truck },
  { label: 'Instant Sellback', icon: Zap }
];

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
  ['Open Boxes', '/boxes'], ['How It Works', '#how-it-works'], ['Shipping Policy', '/shipping'], ['Refund Policy', '/refund'], ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['Contact', '/contact'], ['FAQ', '/faq']
];

const getTopPull = (box: MysteryBox) => [...(box.items || [])].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];
const handleSmoothScroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const SectionHeader = ({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) => (
  <div className="mx-auto mb-7 max-w-3xl text-center sm:mb-10">
    {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-purple-300">{eyebrow}</p> : null}
    <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">{title}</h2>
    {copy ? <p className="mt-3 text-base leading-7 text-slate-300 sm:text-lg">{copy}</p> : null}
  </div>
);

const ActivityPill = ({ activity }: { activity?: HomepageActivityItem }) => activity ? (
  <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-2xl border border-purple-300/15 bg-purple-400/10 px-4 py-3 text-left text-sm text-purple-50">
    <CircleDot className="h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
    <div className="min-w-0"><p className="truncate font-bold">{activity.label}</p><p className="text-xs text-purple-100/75">{activity.detail}{activity.timestampLabel ? ` • ${activity.timestampLabel}` : ''}</p></div>
  </div>
) : null;

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, demoBoxId, trendingBoxIds = [], onOpenBox, onViewAllBoxes, onSignUp }) => {
  const [openFaq, setOpenFaq] = useState(0);
  const [settings, setSettings] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);
  const [activity, setActivity] = useState<HomepageActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadHomepageSettings()
      .then((next) => { if (!cancelled) setSettings(next); })
      .catch(() => { if (!cancelled) setSettings(DEFAULT_HOMEPAGE_SETTINGS); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!settings.activity.enabled) {
      setActivity([]);
      return;
    }
    let cancelled = false;
    loadPublicHomepageActivity(settings.activity.maxItems)
      .then((items) => { if (!cancelled) setActivity(items); })
      .catch(() => { if (!cancelled) setActivity([]); });
    return () => { cancelled = true; };
  }, [settings.activity.enabled, settings.activity.maxItems, settings.activity.refreshMinutes]);

  const featuredBoxes = useMemo<FeaturedBox[]>(() => {
    const orderedIds = [demoBoxId, ...trendingBoxIds].filter(Boolean) as string[];
    const preferred = orderedIds.map((id) => boxes.find((box) => box.id === id)).filter(Boolean) as MysteryBox[];
    const remaining = boxes.filter((box) => !preferred.some((entry) => entry.id === box.id));
    return [...preferred, ...remaining].slice(0, 6).map((box) => ({ ...box, topPull: getTopPull(box) }));
  }, [boxes, demoBoxId, trendingBoxIds]);

  const heroBox = featuredBoxes[0];
  const heroPulls = useMemo(() => boxes.flatMap((box) => (box.items || []).filter((item) => item.image).map((item) => ({ ...item, boxName: box.name }))).sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 3), [boxes]);
  const fallbackProofItems = useMemo(() => boxes.flatMap((box) => (box.items || []).filter((item) => item.image).map((item) => ({ ...item, boxName: box.name }))).sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 8), [boxes]);

  const heroMainImage = settings.hero.mainImageUrl || heroBox?.image || '';
  const leftHeroImage = settings.hero.leftFloatingImageUrl || heroPulls[0]?.image || '';
  const rightHeroImage = settings.hero.rightFloatingImageUrl || heroPulls[1]?.image || '';
  const proofEnabled = settings.visibility.heroProof && settings.hero.featuredWinnerEnabled && settings.hero.featuredWinnerItemName.trim();

  const publishedGallery = useMemo(() => [...settings.gallery.items].sort((a, b) => a.sortOrder - b.sortOrder).filter((item) => item.published && item.imageUrl.trim()), [settings.gallery.items]);
  const galleryItems = publishedGallery.length ? publishedGallery : fallbackProofItems.map((item, index) => ({ id: `${item.id}-${index}`, imageUrl: item.image, imageAlt: `${item.name} collectible pull`, imageFit: 'contain' as const, category: (index % 4 === 0 ? 'Recently Pulled' : index % 4 === 1 ? 'Recently Shipped' : index % 4 === 2 ? 'Community Win' : 'Delivered'), itemName: item.name, caption: '', optionalDate: '', optionalStatus: '', optionalLink: '', published: true, sortOrder: index + 1 }));
  const communityItems = useMemo(() => [...settings.community.items].sort((a, b) => a.sortOrder - b.sortOrder).filter((item) => item.approved && item.published && item.imageUrl.trim()).slice(0, 6), [settings.community.items]);
  const trustCards = useMemo(() => [...settings.trust.cards].sort((a, b) => a.sortOrder - b.sortOrder).filter((card) => card.enabled).slice(0, 4), [settings.trust.cards]);

  const getChaseVisual = (box: FeaturedBox): ChaseVisual => {
    const override = settings.featuredBoxOverrides[box.id];
    if (override?.enabled && override.chaseImageUrl.trim()) {
      return { label: override.chaseLabel || box.topPull?.name || 'Top possible pull', imageUrl: override.chaseImageUrl, imageAlt: override.chaseImageAlt || `${box.name} chase collectible`, secondaryImageUrl: override.secondaryChaseImageUrl, secondaryImageAlt: override.secondaryChaseImageAlt };
    }
    if (box.topPull?.image) return { label: box.topPull.name, imageUrl: box.topPull.image, imageAlt: `${box.topPull.name} top possible pull` };
    return { label: box.name, imageUrl: box.image, imageAlt: `${box.name} box cover` };
  };

  const socialLinks = [
    ['Instagram', settings.social.instagramUrl], ['TikTok', settings.social.tiktokUrl], ['Discord', settings.social.discordUrl], ['X', settings.social.xUrl], ['Facebook', settings.social.facebookUrl], ['YouTube', settings.social.youtubeUrl]
  ].filter(([, url]) => String(url || '').trim());

  return (
    <div className="pullz-home-shell min-h-screen overflow-hidden bg-[#050509] text-white selection:bg-purple-500/40">
      <section className="relative isolate px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_22%,rgba(126,34,206,0.32),transparent_34%),radial-gradient(circle_at_20%_10%,rgba(88,28,135,0.2),transparent_28%),linear-gradient(180deg,#050509_0%,#090713_55%,#050509_100%)]" />
        {settings.hero.backgroundImageUrl ? <img src={settings.hero.backgroundImageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-15" loading="lazy" decoding="async" /> : null}
        <div className="absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl lg:max-w-2xl">
            <p className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.22em] text-purple-200">{settings.hero.eyebrow}</p>
            <h1 className="text-[2.6rem] font-black leading-[0.95] tracking-[-0.06em] text-white min-[375px]:text-5xl sm:text-6xl lg:text-7xl xl:text-[4.75rem]">Open Boxes.<br />Win <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent">{settings.hero.highlightedText}</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">{settings.hero.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onSignUp} className="min-h-12 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-violet-600 px-6 py-3 text-base font-black text-white shadow-[0_0_32px_rgba(168,85,247,0.35)] transition hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">{settings.hero.primaryCtaLabel}</button><button type="button" onClick={() => handleSmoothScroll(settings.hero.secondaryCtaTarget || 'how-it-works')} className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3 text-base font-bold text-white transition hover:border-purple-300/50 hover:bg-purple-400/10 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">{settings.hero.secondaryCtaLabel}</button></div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{TRUST_ITEMS.map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-slate-200"><Icon className="h-4 w-4 text-purple-300" />{label}</div>)}</div>
            <ActivityPill activity={activity[0]} />
          </div>
          <div className="relative mx-auto h-[430px] w-full max-w-[560px] sm:h-[560px]" aria-label="Pullz.gg box and graded Pokémon card display">
            <div className="absolute inset-6 rounded-full bg-purple-600/20 blur-3xl sm:blur-[64px]" /><div className="absolute bottom-16 left-1/2 h-16 w-72 -translate-x-1/2 rounded-full bg-purple-500/35 blur-2xl" />
            {leftHeroImage ? <div className="home-float home-float-slow absolute left-0 top-16 w-32 rotate-[-10deg] rounded-[1.6rem] border border-white/12 bg-slate-950/80 p-3 shadow-2xl backdrop-blur sm:w-44"><img src={leftHeroImage} alt={settings.hero.leftFloatingImageAlt || heroPulls[0]?.name || 'Featured collectible'} width={700} height={1000} className="aspect-[4/5] w-full object-contain" loading="eager" decoding="async" /></div> : null}
            {rightHeroImage ? <div className="home-float home-float-delay absolute right-1 top-8 w-32 rotate-[9deg] rounded-[1.6rem] border border-white/12 bg-slate-950/80 p-3 shadow-2xl backdrop-blur sm:w-40"><img src={rightHeroImage} alt={settings.hero.rightFloatingImageAlt || heroPulls[1]?.name || 'Featured graded collectible'} width={700} height={1000} className="aspect-[4/5] w-full object-contain" loading="lazy" decoding="async" /></div> : null}
            <div className="home-float absolute left-1/2 top-1/2 w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-purple-300/20 bg-gradient-to-br from-[#15111f] via-[#09080d] to-black p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:w-[330px]"><div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.28),transparent_58%),#08070b] p-8 text-center">{heroMainImage ? <img src={heroMainImage} alt={settings.hero.mainImageAlt || `${heroBox?.name ?? 'Pullz.gg'} box`} width={1200} height={1200} className="mx-auto h-44 w-44 object-contain drop-shadow-[0_28px_32px_rgba(0,0,0,0.55)] sm:h-56 sm:w-56" loading="eager" decoding="async" /> : <Box className="mx-auto h-40 w-40 text-purple-300" />}<p className="mt-5 text-xl font-black tracking-tight">Pullz.gg</p><p className="text-sm font-semibold text-purple-200">Premium Pokémon Pull Box</p></div></div>
            {proofEnabled ? <div className="absolute bottom-4 left-1/2 z-20 flex w-[min(92%,360px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-purple-300/20 bg-black/70 p-3 shadow-2xl backdrop-blur"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-purple-500/10">{settings.hero.featuredWinnerImageUrl ? <img src={settings.hero.featuredWinnerImageUrl} alt={settings.hero.featuredWinnerImageAlt || settings.hero.featuredWinnerItemName} width={800} height={1100} className="h-full w-full object-contain" loading="lazy" /> : <Sparkles className="h-6 w-6 text-purple-200" />}</div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-200">{settings.hero.featuredWinnerLabel}</p><p className="truncate text-sm font-black text-white">{settings.hero.featuredWinnerItemName}</p>{settings.hero.featuredWinnerTimestamp ? <p className="text-xs text-slate-300">{settings.hero.featuredWinnerTimestamp}</p> : null}</div></div> : null}
            <span className="home-particle left-[12%] top-[10%]" /><span className="home-particle right-[18%] top-[38%]" /><span className="home-particle bottom-[18%] left-[24%]" />
          </div>
        </div>
      </section>

      {settings.visibility.trust ? <section className="border-y border-white/10 bg-white/[0.025] px-4 py-10 sm:px-6"><div className="mx-auto max-w-7xl"><h2 className="text-center text-2xl font-black sm:text-3xl">Built for Pokémon Collectors</h2><div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{trustCards.map((card) => { const Icon = TRUST_ICONS[card.iconName as keyof typeof TRUST_ICONS] ?? ShieldCheck; return <article key={card.id} className="rounded-3xl border border-white/10 bg-black/30 p-5"><div className="flex items-center gap-3">{card.iconUrl ? <img src={card.iconUrl} alt="" className="h-10 w-10 object-contain" loading="lazy" /> : <Icon className="h-7 w-7 text-purple-300" />}<div><p className="text-xl font-black text-white">{settings.trust.useNumericMetrics && card.value ? card.value : card.heading}</p><p className="text-xs font-bold uppercase tracking-wider text-purple-200">{card.label}</p></div></div>{card.description ? <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p> : null}</article>; })}</div></div></section> : null}

      {settings.visibility.featuredBoxes ? <section className="px-4 py-16 sm:px-6 lg:px-8" id="featured-boxes"><div className="mx-auto max-w-7xl"><SectionHeader title="Choose Your Next Box" />{activity[1] ? <ActivityPill activity={activity[1]} /> : null}{featuredBoxes.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featuredBoxes.map((box) => { const chase = getChaseVisual(box); return <article key={box.id} className="group rounded-[1.75rem] border border-white/10 bg-[#0d0b14] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)]"><div className="relative grid min-h-56 place-items-center overflow-hidden rounded-[1.35rem] bg-[radial-gradient(circle_at_50%_20%,rgba(147,51,234,.25),transparent_55%),#08070b]"><img src={box.image} alt={`${box.name} box`} width={320} height={320} className="h-32 w-32 object-contain opacity-75 transition duration-300 group-hover:scale-95 group-hover:opacity-45" loading="lazy" decoding="async" /><div className="absolute inset-x-6 bottom-5 top-5 grid grid-cols-2 items-center gap-2 opacity-100 transition duration-300 sm:translate-y-2 sm:opacity-80 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"><img src={chase.imageUrl} alt={chase.imageAlt} width={700} height={1000} className="mx-auto max-h-44 w-full object-contain drop-shadow-2xl" loading="lazy" decoding="async" />{chase.secondaryImageUrl ? <img src={chase.secondaryImageUrl} alt={chase.secondaryImageAlt || `${box.name} secondary chase`} width={700} height={1000} className="mx-auto max-h-40 w-full object-contain drop-shadow-2xl" loading="lazy" decoding="async" /> : <div className="hidden sm:block" />}</div></div><div className="pt-5"><h3 className="text-xl font-black text-white">{box.name}</h3><CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} className="mt-2 font-bold text-purple-100" iconClassName="h-4 w-4" /><p className="mt-3 min-h-12 text-sm leading-6 text-slate-300">Open this box for a real Pokémon collectible from Pullz.gg inventory.</p><p className="mt-3 truncate rounded-xl border border-purple-300/15 bg-purple-400/10 px-3 py-2 text-sm font-semibold text-purple-100">Top chase: {chase.label}</p><div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2"><button type="button" onClick={() => onOpenBox(box.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-black transition hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">Open Box <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => onOpenBox(box.id)} className="flex min-h-11 items-center justify-center rounded-2xl border border-white/15 px-3 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2 focus:ring-offset-black">View possible pulls</button></div></div></article>; })}</div> : <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">Boxes are loading. You can still browse the full box catalog.</div>}<div className="mt-8 text-center"><button onClick={onViewAllBoxes} className="rounded-2xl border border-white/15 px-5 py-3 font-bold text-white hover:bg-white/10">View all boxes</button></div></div></section> : null}

      {settings.visibility.howItWorks ? <section id="how-it-works" className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title="Three Steps to Your Next Pull" /><div className="grid gap-4 md:grid-cols-3">{HOW_IT_WORKS.map(({ title, copy, icon: Icon }, index) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200"><Icon /></div><p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">Step {index + 1}</p><h3 className="mt-2 text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-300">{copy}</p></article>)}</div></div></section> : null}

      {settings.visibility.gallery && settings.gallery.enabled ? <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title="Real Wins. Real Deliveries." copy="A collector-focused look at real Pullz.gg pulls and shipment-ready collectibles." />{activity[2] ? <ActivityPill activity={activity[2]} /> : null}{galleryItems.length ? <div className="mt-8 grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{galleryItems.slice(0, 12).map((item) => <figure key={item.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b14]"><div className="grid aspect-[4/5] place-items-center overflow-hidden bg-black/30 p-4"><img src={item.imageUrl} alt={item.imageAlt || item.itemName} width={800} height={1100} className={`h-full w-full transition duration-300 group-hover:scale-[1.03] ${item.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`} loading="lazy" decoding="async" /></div><figcaption className="p-4"><span className="rounded-full bg-purple-400/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-wider text-purple-200">{item.category}</span><p className="mt-3 text-base font-black">{item.itemName}</p>{item.caption ? <p className="mt-1 text-sm leading-6 text-slate-300">{item.caption}</p> : null}<p className="mt-2 text-xs text-slate-400">{[item.optionalDate, item.optionalStatus].filter(Boolean).join(' • ')}</p>{item.optionalLink ? <a href={item.optionalLink} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-purple-200 hover:text-white">View <ExternalLink className="h-3 w-3" /></a> : null}</figcaption></figure>)}</div> : <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">Published wins and delivery images will appear here once added by an admin.</div>}</div></section> : null}

      {settings.visibility.community && settings.community.enabled && (communityItems.length || !settings.community.hideWhenEmpty) ? <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title={settings.community.heading} copy={settings.community.description} />{communityItems.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{communityItems.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="aspect-[4/5] overflow-hidden bg-black/30"><img src={item.imageUrl} alt={item.imageAlt || 'Pullz.gg community highlight'} width={1080} height={1350} className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" loading="lazy" decoding="async" /></div><div className="p-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-purple-200">{item.sourceType}</p><h3 className="mt-2 text-xl font-black">{item.displayName || 'Pullz Collector'}</h3>{item.caption ? <p className="mt-3 text-sm leading-6 text-slate-300">{item.caption}</p> : null}{item.socialUrl ? <a href={item.socialUrl} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-purple-200 hover:text-white">View source <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div></article>)}</div> : <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">{settings.community.emptyMessage || 'Community highlights are being curated.'}</div>}</div></section> : null}

      {settings.visibility.whyPullz ? <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeader title="Why Pullz.gg" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{WHY_PULLZ.map(({ title, copy, icon: Icon }) => <article key={title} className="rounded-3xl border border-white/10 bg-[#0d0b14] p-6"><Icon className="h-7 w-7 text-purple-300" /><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p></article>)}</div></div></section> : null}

      {settings.visibility.freePullCta ? <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl rounded-[2rem] border border-purple-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.28),transparent_58%),#0b0711] p-7 text-center shadow-[0_28px_80px_rgba(88,28,135,.24)] sm:p-12"><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Your First Pull Is Free</h2><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">Create your account, open your first box, and experience Pullz.gg without purchasing coins first.</p><button type="button" onClick={onSignUp} className="mt-7 min-h-12 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-violet-600 px-7 py-3 font-black text-white shadow-[0_0_32px_rgba(168,85,247,0.35)]">Claim My Free Pull</button></div></section> : null}

      {settings.visibility.faq ? <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><SectionHeader title="FAQ" /><div className="space-y-3">{FAQS.map((faq, index) => { const isOpen = openFaq === index; return <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.035]"><button type="button" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? -1 : index)} className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-300">{faq.q}<ChevronDown className={`h-5 w-5 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen ? <p className="px-5 pb-5 leading-7 text-slate-300">{faq.a}</p> : null}</div>; })}</div></div></section> : null}

      {settings.visibility.social && settings.social.enabled && (socialLinks.length || settings.social.bannerImageUrl) ? <section className="px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d0b14]"><div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">{settings.social.bannerImageUrl ? <img src={settings.social.bannerImageUrl} alt={settings.social.bannerImageAlt || 'Pullz.gg community'} width={1600} height={700} className="h-full min-h-64 w-full object-cover" loading="lazy" decoding="async" /> : <div className="min-h-64 bg-[radial-gradient(circle_at_50%_30%,rgba(147,51,234,.3),transparent_58%),#08070b]" />}<div className="p-7 sm:p-10"><h2 className="text-3xl font-black sm:text-4xl">{settings.social.heading}</h2><p className="mt-3 text-base leading-7 text-slate-300">{settings.social.description}</p><div className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">{socialLinks.map(([label, url]) => <a key={label} href={url} className="flex min-h-12 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-400/10 px-4 text-sm font-black text-purple-50 hover:bg-purple-400/20">{label}</a>)}</div><div className="mt-5 flex flex-col gap-3 sm:flex-row">{settings.social.discordUrl ? <a href={settings.social.discordUrl} className="min-h-12 rounded-2xl bg-white px-5 py-3 text-center font-black text-black">Join Discord</a> : null}{settings.social.instagramUrl ? <a href={settings.social.instagramUrl} className="min-h-12 rounded-2xl border border-white/15 px-5 py-3 text-center font-black text-white">Follow on Instagram</a> : null}</div></div></div></div></section> : null}

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between"><div><p className="text-2xl font-black">Pullz.gg</p><p className="mt-2 text-sm text-slate-400">Premium Pokémon collectible boxes.</p></div><nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-300" aria-label="Footer navigation">{FOOTER_LINKS.map(([label, href]) => <a key={label} href={href} className="hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300">{label}</a>)}</nav><div className="flex gap-3 text-sm font-bold text-slate-300">{socialLinks.slice(0, 3).map(([label, url]) => <a key={label} href={url} className="hover:text-white">{label}</a>)}</div></div></footer>
    </div>
  );
};
