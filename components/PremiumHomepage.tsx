import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Music, ShieldCheck, Sparkles, Truck, Zap } from 'lucide-react';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { DEFAULT_HOMEPAGE_SETTINGS, HomepageEntry, HomepageFeature, HomepageLink, HomepageSettings, isExternalDestination, isSafeDestination, loadHomepageSettings } from '../utils/homepageSettings';

type Props = { boxes: MysteryBox[]; trendingBoxIds?: string[]; onOpenBox: (boxId: string) => void; onViewAllBoxes: () => void; onSignUp: () => void };

const sortEnabled = <T extends { enabled?: boolean; sortOrder?: number }>(items: T[] = []) => items.filter((i) => i.enabled !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
const toMs = (value: HomepageFeature['countdownTarget']) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const t = new Date(value).getTime(); return Number.isFinite(t) ? t : null; }
  if (value instanceof Date) return value.getTime();
  if (typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  return null;
};
const useCountdown = (target: HomepageFeature['countdownTarget'], enabled?: boolean) => {
  const targetMs = useMemo(() => toMs(target), [target]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!enabled || !targetMs) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [enabled, targetMs]);
  const diff = Math.max(0, (targetMs ?? 0) - now);
  return { expired: Boolean(enabled && targetMs && diff <= 0), parts: { days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, minutes: Math.floor(diff / 60000) % 60, seconds: Math.floor(diff / 1000) % 60 } };
};
const navigateInternal = (destination: string, setView: ReturnType<typeof useGame>['setView']) => {
  if (destination.startsWith('#')) { document.querySelector(destination)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); window.history.replaceState({}, '', destination); return; }
  if (destination === '/boxes') setView({ type: 'BOXES' });
  else if (destination === '/provably-fair') setView({ type: 'PROVABLY_FAIR' });
  else if (destination === '/profile' || destination === '/inventory') setView({ type: destination === '/inventory' ? 'INVENTORY' : 'PROFILE' });
  else if (destination === '/' || destination === '') setView({ type: 'HOME' });
  else if (destination.startsWith('/case/')) setView({ type: 'CASE_OPENING', boxId: destination.split('/').pop() || '', isFree: destination.includes('free') });
  else setView({ type: 'HOME' });
  window.history.replaceState({}, '', destination);
};
export const SafeHomepageLink: React.FC<React.PropsWithChildren<{ destination?: string; openInNewTab?: boolean; className?: string; disabledClassName?: string; onClick?: () => void; ariaLabel?: string; style?: React.CSSProperties }>> = ({ destination, openInNewTab, className, disabledClassName, onClick, children, ariaLabel, style }) => {
  const { setView } = useGame();
  const safe = isSafeDestination(destination);
  if (!safe) return <span aria-disabled="true" className={disabledClassName ?? className} style={style}>{children}</span>;
  if (isExternalDestination(destination)) return <a href={destination} target={openInNewTab ? '_blank' : undefined} rel={openInNewTab ? 'noopener noreferrer' : undefined} className={className} style={style} aria-label={ariaLabel}>{children}</a>;
  return <a href={destination} className={className} style={style} aria-label={ariaLabel} onClick={(e) => { e.preventDefault(); onClick?.(); navigateInternal(destination!, setView); }}>{children}</a>;
};
const SmartImage = ({ src, mobileSrc, alt, className, eager, fit = 'cover', focal = 'center' }: { src?: string; mobileSrc?: string; alt?: string; className?: string; eager?: boolean; fit?: 'cover' | 'contain'; focal?: string }) => {
  const [failed, setFailed] = useState(false); const image = (mobileSrc && typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? mobileSrc : src) || src;
  if (!image || failed) return null;
  return <img src={image} alt={alt ?? ''} width={900} height={600} loading={eager ? 'eager' : 'lazy'} decoding={eager ? 'sync' : 'async'} onError={() => setFailed(true)} className={className} style={{ objectFit: fit, objectPosition: focal }} />;
};
const Countdown = ({ feature }: { feature: HomepageFeature }) => { const { expired, parts } = useCountdown(feature.countdownTarget, feature.countdownEnabled); if (!feature.countdownEnabled) return null; if (expired) { if (feature.expiredMode === 'hide') return null; return <div className="ph-live">{feature.expiredMode === 'custom' ? feature.expiredMessage : 'Live Now'}</div>; } return <div className="ph-countdown" aria-label="Countdown timer">{Object.entries(parts).map(([k,v]) => <span key={k}><b>{String(v).padStart(2,'0')}</b><small>{k.slice(0,3)}</small></span>)}</div>; };
const FeatureBanner = ({ feature, eager }: { feature: HomepageFeature; eager?: boolean }) => !feature.enabled ? null : <article className="ph-banner" style={{ ['--accent' as any]: feature.accent || '#7c3cff' }}><SafeHomepageLink destination={feature.destination} openInNewTab={feature.openInNewTab} className="ph-banner-art"><SmartImage src={feature.imageUrl} mobileSrc={feature.mobileImageUrl} alt={feature.alt || feature.heading} eager={eager} fit={feature.fit} focal={feature.focalPosition} /><span>{!feature.imageUrl ? 'Featured art configurable in Admin' : ''}</span></SafeHomepageLink><div className="ph-banner-copy"><p>{feature.eyebrow}</p><h2>{feature.heading}</h2><Countdown feature={feature}/>{feature.ctaLabel && <SafeHomepageLink destination={feature.ctaDestination} className="ph-mini-cta">{feature.ctaLabel}</SafeHomepageLink>}</div></article>;
const getBoxImage = (box: MysteryBox) => box.image || box.items?.find((item) => item.image)?.image || '';
export const PremiumHomepage: React.FC<Props> = ({ boxes, trendingBoxIds = [], onOpenBox, onViewAllBoxes, onSignUp }) => {
  const { openAuthModal, setView, isAuthenticated } = useGame();
  const [settings, setSettings] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);
  const [activity, setActivity] = useState<HomepageEntry[]>([]);
  useEffect(() => { let cancelled = false; loadHomepageSettings().then((s) => !cancelled && setSettings(s)).catch(() => !cancelled && setSettings(DEFAULT_HOMEPAGE_SETTINGS)); return () => { cancelled = true; }; }, []);
  useEffect(() => { let cancelled = false; const load = async () => { if (!settings.activityRail.useLiveData) return; try { const snap = await getDocs(query(collection(db, 'publicActivity'), orderBy('createdAt','desc'), limit(settings.activityRail.maxItems || 10))); if (!cancelled) setActivity(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((x) => x.title || x.heading)); } catch { if (!cancelled) setActivity([]); } }; void load(); }, [settings.activityRail.useLiveData, settings.activityRail.maxItems]);
  const featuredBoxes = useMemo(() => { const overrides = sortEnabled(settings.featuredBoxes.items); const selected = overrides.length ? overrides.map((o) => ({ o, box: boxes.find((b) => b.id === o.boxId) })).filter((x) => x.box) : boxes.slice(0, 6).map((box, i) => ({ box, o: { id: box.id, sortOrder: i } as HomepageEntry })); return selected.slice(0, 6); }, [boxes, settings.featuredBoxes.items]);
  const rail = (activity.length ? activity : sortEnabled(settings.activityRail.manualItems)).slice(0, settings.activityRail.maxItems || 10);
  const nav = sortEnabled<HomepageLink>(settings.navigation.links);
  const doFree = () => { if (isAuthenticated) { setView({ type: 'CASE_OPENING', boxId: 'free-box', isFree: true }); window.history.replaceState({}, '', '/case/free-box'); } else { onSignUp(); } };
  return <div className="premium-home"><nav className="ph-nav" aria-label="Homepage navigation"><div className="ph-logo"><span/>PULLZ <em>GG</em></div><div className="ph-navlinks">{nav.filter(l => !['signin','free'].includes(l.id)).map((l) => <SafeHomepageLink key={l.id} destination={l.destination} openInNewTab={l.openInNewTab}>{l.label}</SafeHomepageLink>)}</div><div className="ph-actions"><button aria-label="Sound preferences"><Music size={15}/></button><button onClick={() => openAuthModal('login')}>{nav.find(l=>l.id==='signin')?.label || 'Sign In'}</button><button onClick={doFree}>{nav.find(l=>l.id==='free')?.label || 'Open Free Box'}</button></div></nav>{settings.visibility.trustStats && settings.trustStats.enabled && <section className="ph-trust">{sortEnabled(settings.trustStats.items).map((s, i) => <SafeHomepageLink destination={s.destination} key={s.id} className="ph-trust-card"><span>{[<ShieldCheck/>,<Zap/>,<Sparkles/>,<Truck/>][i%4]}</span><b>{s.heading}</b><small>{s.description}</small></SafeHomepageLink>)}</section>}{settings.visibility.activityRail && settings.activityRail.enabled && rail.length > 0 && <section className="ph-rail" tabIndex={0} aria-label="Recent activity">{rail.map((item) => <SafeHomepageLink key={item.id} destination={item.destination} className="ph-activity" style={{ ['--accent' as any]: item.accent || '#7c3cff' } as any}><small>{item.label || 'Live'}</small><div><SmartImage src={item.imageUrl} alt={item.alt || item.title || ''} fit="contain" /></div><b>{item.title || item.heading}</b></SafeHomepageLink>)}</section>}<section className="ph-banners">{settings.visibility.dailyFeature && <FeatureBanner feature={settings.dailyFeature} eager />}{settings.visibility.weeklyFeature && <FeatureBanner feature={settings.weeklyFeature} />}</section>{settings.visibility.featuredBoxes && settings.featuredBoxes.enabled && <section id="featured" className="ph-section"><h2><span/>Featured Boxes</h2><div className="ph-boxgrid">{featuredBoxes.map(({ box, o }: any) => <button key={box.id} className="ph-box" onClick={() => { const dest = o.destinationOverride; if (dest && isSafeDestination(dest)) navigateInternal(dest, setView); else onOpenBox(box.id); }} style={{ ['--accent' as any]: o.accent || '#7c3cff' }}><div><SmartImage src={o.imageUrl || getBoxImage(box)} mobileSrc={o.mobileImageUrl} alt={o.imageAlt || box.name} fit="contain" /></div><b>{o.displayTitle || box.name}</b><span>{o.displayPriceEnabled && o.displayPrice ? o.displayPrice : <CoinAmount amount={box.price} />}</span></button>)}</div><button className="ph-view-all" onClick={onViewAllBoxes}>View all boxes</button></section>}<section className="ph-editorial"><div><p>{settings.editorialFeature.eyebrow}</p><h2>{settings.editorialFeature.heading}</h2><p>{settings.editorialFeature.description}</p><SafeHomepageLink destination={settings.editorialFeature.ctaDestination} className="ph-cta">{settings.editorialFeature.ctaLabel}</SafeHomepageLink><SmartImage src={settings.editorialFeature.imageUrl} mobileSrc={settings.editorialFeature.mobileImageUrl} alt={settings.editorialFeature.alt || ''} /></div>{settings.visibility.supportingCards && <aside>{sortEnabled(settings.supportingCards.items).map((c) => <SafeHomepageLink key={c.id} destination={c.destination} className="ph-support"><SmartImage src={c.imageUrl} alt={c.alt || c.heading || ''} /><h3>{c.heading}</h3><p>{c.description}</p></SafeHomepageLink>)}</aside>}</section>{settings.visibility.community && settings.community.enabled && <section id="community" className="ph-community"><header><div><h2>{settings.community.heading}</h2><p>{settings.community.description}</p></div><SafeHomepageLink destination="#community">View Community</SafeHomepageLink></header><div>{sortEnabled(settings.community.items).filter(i => i.approved !== false && i.published !== false).slice(0, settings.community.maxItems || 4).map((c) => <SafeHomepageLink key={c.id} destination={c.destination} className="ph-community-card"><SmartImage src={c.imageUrl} alt={c.alt || c.heading || ''} /><h3>{c.heading}</h3><p>{c.caption || c.description}</p></SafeHomepageLink>)}</div></section>}{settings.visibility.freePullCta && settings.freePullCta.enabled && <section className="ph-free"><SmartImage src={settings.freePullCta.imageUrl} alt={settings.freePullCta.alt || ''} /><h2>{settings.freePullCta.heading}</h2><p>{settings.freePullCta.description}</p><button onClick={doFree}>{settings.freePullCta.ctaLabel}</button></section>}</div>;
};
export default PremiumHomepage;
