import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

export type ImageFit = 'contain' | 'cover';
export type GalleryCategory = 'Recently Pulled' | 'Recently Shipped' | 'Community Win' | 'Delivered' | 'Customer Photo';

export type HomepageTrustCard = { id: string; heading: string; value: string; label: string; description: string; iconName: string; iconUrl: string; enabled: boolean; sortOrder: number };
export type HomepageGalleryItem = { id: string; imageUrl: string; imageAlt: string; imageFit: ImageFit; category: GalleryCategory; itemName: string; caption: string; optionalDate: string; optionalStatus: string; optionalLink: string; published: boolean; sortOrder: number };
export type HomepageCommunityItem = { id: string; imageUrl: string; imageAlt: string; displayName: string; caption: string; sourceType: string; socialUrl: string; approved: boolean; published: boolean; sortOrder: number; createdDate: string };
export type HomepageActivityItem = { id: string; label: string; detail: string; timestampLabel: string; published?: boolean; sortOrder?: number; createdAt?: unknown };

export type HomepageSettings = {
  hero: {
    eyebrow: string;
    headline: string;
    highlightedText: string;
    body: string;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
    secondaryCtaLabel: string;
    secondaryCtaTarget: string;
    mainImageUrl: string;
    mainImageAlt: string;
    leftFloatingImageUrl: string;
    leftFloatingImageAlt: string;
    rightFloatingImageUrl: string;
    rightFloatingImageAlt: string;
    backgroundImageUrl: string;
    backgroundImageAlt: string;
    featuredWinnerEnabled: boolean;
    featuredWinnerImageUrl: string;
    featuredWinnerImageAlt: string;
    featuredWinnerItemName: string;
    featuredWinnerLabel: string;
    featuredWinnerTimestamp: string;
  };
  trust: { useNumericMetrics: boolean; cards: HomepageTrustCard[] };
  featuredBoxOverrides: Record<string, { chaseImageUrl: string; chaseImageAlt: string; secondaryChaseImageUrl: string; secondaryChaseImageAlt: string; chaseLabel: string; enabled: boolean }>;
  gallery: { enabled: boolean; items: HomepageGalleryItem[] };
  community: { enabled: boolean; hideWhenEmpty: boolean; emptyMessage: string; heading: string; description: string; items: HomepageCommunityItem[] };
  activity: { enabled: boolean; maxItems: number; refreshMinutes: number; fallbackItems: HomepageActivityItem[] };
  social: { enabled: boolean; heading: string; description: string; bannerImageUrl: string; bannerImageAlt: string; instagramUrl: string; tiktokUrl: string; discordUrl: string; xUrl: string; facebookUrl: string; youtubeUrl: string };
  visibility: { heroProof: boolean; trust: boolean; featuredBoxes: boolean; howItWorks: boolean; gallery: boolean; community: boolean; whyPullz: boolean; freePullCta: boolean; faq: boolean; social: boolean; publicPlaceholders: boolean };
};

export const HOMEPAGE_CONTENT_DOC_PATH = 'site/homepage';
const HOMEPAGE_DOC_REF = doc(db, 'site', 'homepage');

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  hero: {
    eyebrow: 'REAL COLLECTIBLES. REAL SHIPMENTS.',
    headline: 'Open Boxes.\nWin',
    highlightedText: 'Real Pokémon Cards.',
    body: 'Every pull is a real collectible you can ship to your door or sell back instantly. Open your first box free and see how Pullz.gg works.',
    primaryCtaLabel: 'Open Your First Box',
    primaryCtaUrl: '/case/free-box',
    secondaryCtaLabel: 'How It Works',
    secondaryCtaTarget: 'how-it-works',
    mainImageUrl: '',
    mainImageAlt: 'Pullz.gg premium Pokémon box',
    leftFloatingImageUrl: '',
    leftFloatingImageAlt: 'Featured Pokémon collectible card',
    rightFloatingImageUrl: '',
    rightFloatingImageAlt: 'Featured graded Pokémon collectible',
    backgroundImageUrl: '',
    backgroundImageAlt: '',
    featuredWinnerEnabled: false,
    featuredWinnerImageUrl: '',
    featuredWinnerImageAlt: 'Recently won collectible',
    featuredWinnerItemName: '',
    featuredWinnerLabel: 'Recently Won',
    featuredWinnerTimestamp: ''
  },
  trust: {
    useNumericMetrics: false,
    cards: [
      { id: 'real-inventory', heading: 'Real Inventory', value: '', label: 'Real Inventory', description: 'Every public box is backed by collectible inventory.', iconName: 'package', iconUrl: '', enabled: true, sortOrder: 1 },
      { id: 'verified-openings', heading: 'Verified Openings', value: '', label: 'Verified Openings', description: 'Openings are supported by Pullz.gg systems and account history.', iconName: 'shield', iconUrl: '', enabled: true, sortOrder: 2 },
      { id: 'tracked-shipping', heading: 'Tracked Shipping', value: '', label: 'Tracked Shipping', description: 'Eligible collectibles can be requested for shipment from inventory.', iconName: 'truck', iconUrl: '', enabled: true, sortOrder: 3 },
      { id: 'secure-payments', heading: 'Secure Payments', value: '', label: 'Secure Payments', description: 'Checkout and account features use the existing secure payment flow.', iconName: 'check', iconUrl: '', enabled: true, sortOrder: 4 }
    ]
  },
  featuredBoxOverrides: {},
  gallery: { enabled: true, items: [] },
  community: { enabled: true, hideWhenEmpty: true, emptyMessage: '', heading: 'Community Highlights', description: 'See what collectors are pulling, shipping, and sharing.', items: [] },
  activity: { enabled: false, maxItems: 3, refreshMinutes: 15, fallbackItems: [] },
  social: { enabled: true, heading: 'Join the Pullz.gg Community', description: 'Follow new box drops, recent wins, shipment updates, and collector highlights.', bannerImageUrl: '', bannerImageAlt: 'Pullz.gg community banner', instagramUrl: '', tiktokUrl: '', discordUrl: '', xUrl: '', facebookUrl: '', youtubeUrl: '' },
  visibility: { heroProof: true, trust: true, featuredBoxes: true, howItWorks: true, gallery: true, community: true, whyPullz: true, freePullCta: true, faq: true, social: true, publicPlaceholders: false }
};

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const num = (value: unknown, fallback: number, min = 0, max = 100) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
};
const safeId = () => `home_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const normalizeTrustCard = (card: Partial<HomepageTrustCard> & Record<string, unknown>, index: number): HomepageTrustCard => ({
  id: text(card.id, safeId()),
  heading: text(card.heading, text(card.label, DEFAULT_HOMEPAGE_SETTINGS.trust.cards[index]?.heading ?? 'Trust Card')),
  value: text(card.value),
  label: text(card.label, text(card.heading, 'Trust signal')),
  description: text(card.description),
  iconName: text(card.iconName, 'shield'),
  iconUrl: text(card.iconUrl),
  enabled: bool(card.enabled, true),
  sortOrder: num(card.sortOrder, index + 1, 0, 999)
});

const normalizeGalleryItem = (item: Partial<HomepageGalleryItem> & Record<string, unknown>, index: number): HomepageGalleryItem => ({
  id: text(item.id, safeId()),
  imageUrl: text(item.imageUrl),
  imageAlt: text(item.imageAlt, text(item.itemName, 'Pullz.gg collectible')),
  imageFit: item.imageFit === 'cover' ? 'cover' : 'contain',
  category: ['Recently Pulled', 'Recently Shipped', 'Community Win', 'Delivered', 'Customer Photo'].includes(text(item.category)) ? text(item.category) as GalleryCategory : 'Recently Pulled',
  itemName: text(item.itemName, 'Collectible'),
  caption: text(item.caption),
  optionalDate: text(item.optionalDate),
  optionalStatus: text(item.optionalStatus),
  optionalLink: text(item.optionalLink),
  published: bool(item.published, false),
  sortOrder: num(item.sortOrder, index + 1, 0, 999)
});

const normalizeCommunityItem = (item: Partial<HomepageCommunityItem> & Record<string, unknown>, index: number): HomepageCommunityItem => ({
  id: text(item.id, safeId()),
  imageUrl: text(item.imageUrl),
  imageAlt: text(item.imageAlt, 'Pullz.gg community highlight'),
  displayName: text(item.displayName, 'Pullz Collector'),
  caption: text(item.caption),
  sourceType: text(item.sourceType, 'Community photo'),
  socialUrl: text(item.socialUrl),
  approved: bool(item.approved, false),
  published: bool(item.published, false),
  sortOrder: num(item.sortOrder, index + 1, 0, 999),
  createdDate: text(item.createdDate)
});

export const normalizeHomepageSettings = (value?: Partial<HomepageSettings> | null): HomepageSettings => {
  const draft = value ?? {};
  return {
    hero: { ...DEFAULT_HOMEPAGE_SETTINGS.hero, ...(draft.hero ?? {}) },
    trust: {
      useNumericMetrics: bool(draft.trust?.useNumericMetrics, DEFAULT_HOMEPAGE_SETTINGS.trust.useNumericMetrics),
      cards: (Array.isArray(draft.trust?.cards) && draft.trust.cards.length ? draft.trust.cards : DEFAULT_HOMEPAGE_SETTINGS.trust.cards).map((card, index) => normalizeTrustCard(card as any, index)).slice(0, 4)
    },
    featuredBoxOverrides: typeof draft.featuredBoxOverrides === 'object' && draft.featuredBoxOverrides ? draft.featuredBoxOverrides : {},
    gallery: { enabled: bool(draft.gallery?.enabled, true), items: (Array.isArray(draft.gallery?.items) ? draft.gallery.items : []).map((item, index) => normalizeGalleryItem(item as any, index)).slice(0, 24) },
    community: {
      enabled: bool(draft.community?.enabled, true),
      hideWhenEmpty: bool(draft.community?.hideWhenEmpty, true),
      emptyMessage: text(draft.community?.emptyMessage),
      heading: text(draft.community?.heading, DEFAULT_HOMEPAGE_SETTINGS.community.heading),
      description: text(draft.community?.description, DEFAULT_HOMEPAGE_SETTINGS.community.description),
      items: (Array.isArray(draft.community?.items) ? draft.community.items : []).map((item, index) => normalizeCommunityItem(item as any, index)).slice(0, 24)
    },
    activity: { enabled: bool(draft.activity?.enabled, false), maxItems: num(draft.activity?.maxItems, 3, 1, 6), refreshMinutes: num(draft.activity?.refreshMinutes, 15, 5, 120), fallbackItems: Array.isArray(draft.activity?.fallbackItems) ? draft.activity.fallbackItems.slice(0, 6) : [] },
    social: { ...DEFAULT_HOMEPAGE_SETTINGS.social, ...(draft.social ?? {}) },
    visibility: { ...DEFAULT_HOMEPAGE_SETTINGS.visibility, ...(draft.visibility ?? {}) }
  };
};

let cachedSettings: HomepageSettings | null = null;
let cachedAt = 0;

export const loadHomepageSettings = async (cacheMs = 5 * 60 * 1000) => {
  const now = Date.now();
  if (cachedSettings && now - cachedAt < cacheMs) return cachedSettings;
  const snapshot = await getDoc(HOMEPAGE_DOC_REF);
  const next = normalizeHomepageSettings(snapshot.exists() ? snapshot.data() as Partial<HomepageSettings> : null);
  cachedSettings = next;
  cachedAt = now;
  return next;
};

export const saveHomepageSettings = async (settings: HomepageSettings, adminUid?: string) => {
  const normalized = normalizeHomepageSettings(settings);
  await setDoc(HOMEPAGE_DOC_REF, { ...normalized, updatedAt: serverTimestamp(), updatedBy: adminUid ?? null }, { merge: true });
  cachedSettings = normalized;
  cachedAt = Date.now();
};

export const loadPublicHomepageActivity = async (maxItems = 3) => {
  const activityQuery = query(collection(db, 'homepageActivity'), where('published', '==', true), orderBy('sortOrder', 'asc'), limit(Math.max(1, Math.min(6, maxItems))));
  const snapshot = await getDocs(activityQuery);
  return snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<HomepageActivityItem, 'id'>) }));
};

export const makeHomepageContentId = safeId;

export const isSafeImageUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};
