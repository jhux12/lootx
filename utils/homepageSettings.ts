import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type HomepageLink = { id: string; label: string; destination: string; openInNewTab?: boolean; enabled?: boolean; sortOrder?: number };
export type HomepageImageSlot = { imageUrl?: string; mobileImageUrl?: string; alt?: string; destination?: string; openInNewTab?: boolean; fit?: 'cover' | 'contain'; focalPosition?: string; enabled?: boolean };
export type HomepageEntry = HomepageImageSlot & { id: string; label?: string; title?: string; heading?: string; description?: string; caption?: string; accent?: string; sortOrder?: number; sourceType?: string; published?: boolean; approved?: boolean; boxId?: string; displayTitle?: string; displayPrice?: string; displayPriceEnabled?: boolean; destinationOverride?: string };
export type HomepageFeature = HomepageImageSlot & { enabled?: boolean; eyebrow: string; heading: string; description?: string; ctaLabel?: string; ctaDestination?: string; countdownEnabled?: boolean; countdownTarget?: Timestamp | Date | string | number | null; accent?: string; expiredMode?: 'hide' | 'live' | 'custom'; expiredMessage?: string };
export type HomepageSettings = {
  navigation: { links: HomepageLink[] };
  trustStats: { enabled: boolean; items: HomepageEntry[] };
  activityRail: { enabled: boolean; useLiveData: boolean; maxItems: number; manualItems: HomepageEntry[] };
  dailyFeature: HomepageFeature;
  weeklyFeature: HomepageFeature;
  featuredBoxes: { enabled: boolean; items: HomepageEntry[] };
  editorialFeature: HomepageFeature;
  supportingCards: { enabled: boolean; items: HomepageEntry[] };
  community: { enabled: boolean; heading: string; description: string; maxItems: number; items: HomepageEntry[] };
  freePullCta: HomepageFeature;
  visibility: Record<string, boolean>;
  seo: { title?: string; description?: string; imageUrl?: string };
};

export const HOMEPAGE_SETTINGS_PATH = 'site/homepage';
export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  navigation: { links: [
    { id: 'home', label: 'Home', destination: '/', enabled: true, sortOrder: 0 },
    { id: 'boxes', label: 'Boxes', destination: '/boxes', enabled: true, sortOrder: 1 },
    { id: 'featured', label: 'Featured', destination: '#featured', enabled: true, sortOrder: 2 },
    { id: 'community', label: 'Community', destination: '#community', enabled: true, sortOrder: 3 },
    { id: 'fair', label: 'Provably Fair', destination: '/provably-fair', enabled: true, sortOrder: 4 },
    { id: 'signin', label: 'Sign In', destination: '/login', enabled: true, sortOrder: 5 },
    { id: 'free', label: 'Open Free Box', destination: '/case/free-box', enabled: true, sortOrder: 6 }
  ] },
  trustStats: { enabled: true, items: [
    { id: 'real', heading: 'Real Items', description: 'Every pull can be shipped', destination: '/boxes', enabled: true, sortOrder: 0 },
    { id: 'instant', heading: 'Instant Opens', description: 'No waiting on reveals', destination: '/boxes', enabled: true, sortOrder: 1 },
    { id: 'fair', heading: 'Verified Odds', description: 'Provably fair results', destination: '/provably-fair', enabled: true, sortOrder: 2 },
    { id: 'sell', heading: 'Sell Back', description: 'Exchange items for coins', destination: '/inventory', enabled: true, sortOrder: 3 },
    { id: 'ship', heading: 'Tracked Shipping', description: 'Manage orders in account', destination: '/profile', enabled: true, sortOrder: 4 }
  ] },
  activityRail: { enabled: true, useLiveData: true, maxItems: 10, manualItems: [] },
  dailyFeature: { enabled: true, eyebrow: 'Daily Featured Pull', heading: 'Collector chase spotlight', ctaLabel: 'View Boxes', ctaDestination: '/boxes', countdownEnabled: false, accent: '#5b5bff', expiredMode: 'live' },
  weeklyFeature: { enabled: true, eyebrow: 'Weekly Community Drop', heading: 'Collector favorite box', ctaLabel: 'Explore Drops', ctaDestination: '/boxes', countdownEnabled: false, accent: '#8a4dff', expiredMode: 'live' },
  featuredBoxes: { enabled: true, items: [] },
  editorialFeature: { enabled: true, eyebrow: 'More Than a Box Grid', heading: 'Open real collectibles in a site that feels alive.', description: 'Combine live activity, featured pulls, real shipping proof, and limited box drops without making the experience look like a casino.', ctaLabel: 'Open Your First Box', ctaDestination: '/case/free-box' },
  supportingCards: { enabled: true, items: [
    { id: 'inventory', heading: 'Real inventory', description: 'Use actual shelves, slabs, sealed products, and box photography.', destination: '/boxes', enabled: true, sortOrder: 0 },
    { id: 'fair', heading: 'Provably fair', description: 'Keep odds and verification accessible without crowding the experience.', destination: '/provably-fair', enabled: true, sortOrder: 1 }
  ] },
  community: { enabled: true, heading: 'Community Highlights', description: 'Approved customer content and collector moments.', maxItems: 4, items: [] },
  freePullCta: { enabled: true, heading: 'Your First Pull Is Free', description: 'Create an account, open your first box, and experience Pullz before purchasing coins.', ctaLabel: 'Claim My Free Pull', ctaDestination: '/case/free-box' },
  visibility: { trustStats: true, activityRail: true, dailyFeature: true, weeklyFeature: true, featuredBoxes: true, editorialFeature: true, supportingCards: true, community: true, freePullCta: true },
  seo: {}
};
export const mergeHomepageSettings = (input?: Partial<HomepageSettings> | null): HomepageSettings => ({ ...DEFAULT_HOMEPAGE_SETTINGS, ...(input ?? {}), navigation: { ...DEFAULT_HOMEPAGE_SETTINGS.navigation, ...(input?.navigation ?? {}) }, trustStats: { ...DEFAULT_HOMEPAGE_SETTINGS.trustStats, ...(input?.trustStats ?? {}) }, activityRail: { ...DEFAULT_HOMEPAGE_SETTINGS.activityRail, ...(input?.activityRail ?? {}) }, featuredBoxes: { ...DEFAULT_HOMEPAGE_SETTINGS.featuredBoxes, ...(input?.featuredBoxes ?? {}) }, editorialFeature: { ...DEFAULT_HOMEPAGE_SETTINGS.editorialFeature, ...(input?.editorialFeature ?? {}) }, supportingCards: { ...DEFAULT_HOMEPAGE_SETTINGS.supportingCards, ...(input?.supportingCards ?? {}) }, community: { ...DEFAULT_HOMEPAGE_SETTINGS.community, ...(input?.community ?? {}) }, freePullCta: { ...DEFAULT_HOMEPAGE_SETTINGS.freePullCta, ...(input?.freePullCta ?? {}) }, visibility: { ...DEFAULT_HOMEPAGE_SETTINGS.visibility, ...(input?.visibility ?? {}) }, seo: { ...DEFAULT_HOMEPAGE_SETTINGS.seo, ...(input?.seo ?? {}) } });
export const loadHomepageSettings = async () => { const snap = await getDoc(doc(db, 'site', 'homepage')); return snap.exists() ? mergeHomepageSettings(snap.data() as Partial<HomepageSettings>) : DEFAULT_HOMEPAGE_SETTINGS; };
export const saveHomepageSettings = async (settings: HomepageSettings, uid?: string) => setDoc(doc(db, 'site', 'homepage'), { ...settings, updatedAt: serverTimestamp(), updatedBy: uid ?? null }, { merge: true });
export const isSafeDestination = (dest?: string) => { const d = (dest ?? '').trim(); if (!d) return false; if (d.startsWith('/') || d.startsWith('#')) return true; try { const u = new URL(d); return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')); } catch { return false; } };
export const isExternalDestination = (dest?: string) => { if (!isSafeDestination(dest)) return false; return /^https?:\/\//i.test((dest ?? '').trim()); };
export const isSafeImageUrl = (url?: string) => { const u = (url ?? '').trim(); if (!u) return true; try { const parsed = new URL(u); return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname)); } catch { return false; } };
