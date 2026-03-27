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
  weight: Number(target.weight ?? 1),
  minSourceValue: target.minSourceValue == null ? undefined : Number(target.minSourceValue),
  maxSourceValue: target.maxSourceValue == null ? undefined : Number(target.maxSourceValue)
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
    const q = query(collection(db, 'upgraderTargets'), where('enabled', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return normalizeTarget({
        id: docSnapshot.id,
        name: data.name,
        imageUrl: data.imageUrl,
        coinValue: data.coinValue,
        rarity: data.rarity,
        category: data.category,
        enabled: data.enabled,
        featured: data.featured,
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
