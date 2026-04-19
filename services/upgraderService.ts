import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { normalizeUpgraderSettings, UpgraderTarget } from '../utils/upgrader';

type PublicUpgraderConfigResponse = {
  ok: boolean;
  settings?: Record<string, unknown>;
  targets?: UpgraderTarget[];
};

const normalizeTarget = (target: Partial<UpgraderTarget>): UpgraderTarget => ({
  id: String(target.id ?? ''),
  name: String(target.name ?? 'Unknown target'),
  imageUrl: String(target.imageUrl ?? ''),
  coinValue: Number(target.coinValue ?? 0),
  rarity: String(target.rarity ?? 'common'),
  category: String(target.category ?? ''),
  enabled: target.enabled === true,
  featured: target.featured === true,
  upgraderSort: target.upgraderSort == null ? undefined : Number(target.upgraderSort),
  weight: Number(target.weight ?? 1),
  minSourceValue: target.minSourceValue == null ? undefined : Number(target.minSourceValue),
  maxSourceValue: target.maxSourceValue == null ? undefined : Number(target.maxSourceValue)
});

const normalizeCategory = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['tech', 'collectible', 'apparel'].includes(normalized) ? normalized : '';
};

const normalizeTargetFromItem = (target: Partial<UpgraderTarget> & {
  image?: string;
  value?: number;
  price?: number;
  upgraderEnabled?: boolean;
  upgraderCategory?: string;
  upgraderSort?: number;
  upgraderFeatured?: boolean;
}): UpgraderTarget => normalizeTarget({
  id: String(target.id ?? ''),
  name: String(target.name ?? 'Unknown target'),
  imageUrl: String(target.imageUrl ?? target.image ?? ''),
  coinValue: Number(target.coinValue ?? target.value ?? target.price ?? 0),
  rarity: String(target.rarity ?? 'common'),
  category: normalizeCategory(target.upgraderCategory ?? target.category),
  enabled: target.upgraderEnabled === true || target.enabled === true,
  featured: target.upgraderFeatured === true || target.featured === true,
  weight: Number(target.weight ?? 1),
  minSourceValue: target.minSourceValue == null ? undefined : Number(target.minSourceValue),
  maxSourceValue: target.maxSourceValue == null ? undefined : Number(target.maxSourceValue),
  upgraderSort: target.upgraderSort
});

const getPublicUpgraderConfig = async (): Promise<{ settings: Record<string, unknown>; targets: UpgraderTarget[] }> => {
  const response = await fetch('/api/upgrader-config', {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load upgrader config (${response.status})`);
  }

  const payload = (await response.json()) as PublicUpgraderConfigResponse;
  if (!payload.ok) {
    throw new Error('Failed to load upgrader config');
  }

  return {
    settings: payload.settings ?? {},
    targets: (payload.targets ?? []).map((entry) => normalizeTarget(entry))
  };
};

export const getUpgraderSettings = async () => {
  try {
    const { settings } = await getPublicUpgraderConfig();
    return normalizeUpgraderSettings(settings);
  } catch {
    const snapshot = await getDoc(doc(db, 'settings', 'upgrader'));
    return normalizeUpgraderSettings(snapshot.exists() ? snapshot.data() : undefined);
  }
};

export const getUpgraderTargets = async () => {
  try {
    const { targets } = await getPublicUpgraderConfig();
    return targets;
  } catch {
    const q = query(collection(db, 'items'), where('upgraderEnabled', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return normalizeTargetFromItem({
        id: docSnapshot.id,
        name: data.name,
        image: data.image,
        imageUrl: data.imageUrl,
        value: data.value,
        price: data.price,
        coinValue: data.coinValue,
        rarity: data.rarity,
        category: data.category,
        upgraderCategory: data.upgraderCategory,
        upgraderSort: data.upgraderSort,
        enabled: data.enabled,
        upgraderEnabled: data.upgraderEnabled,
        featured: data.featured,
        upgraderFeatured: data.upgraderFeatured,
        weight: data.weight,
        minSourceValue: data.minSourceValue,
        maxSourceValue: data.maxSourceValue
      });
    });
  }
};

export const attemptUpgrade = async (payload: { sourceItemInstanceId: string; targetItemId: string; clientSeed?: string }) => {
  const response = await authedFetch<any>('/api/attempt-upgrade', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return response;
};
