import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { normalizeUpgraderSettings, UpgraderTarget } from '../utils/upgrader';

export const getUpgraderSettings = async () => {
  const snapshot = await getDoc(doc(db, 'settings', 'upgrader'));
  return normalizeUpgraderSettings(snapshot.exists() ? snapshot.data() : undefined);
};

export const getUpgraderTargets = async () => {
  const q = query(collection(db, 'upgraderTargets'), where('enabled', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnapshot) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      name: String(data.name ?? 'Unknown target'),
      imageUrl: String(data.imageUrl ?? ''),
      coinValue: Number(data.coinValue ?? 0),
      rarity: String(data.rarity ?? 'common'),
      category: String(data.category ?? ''),
      enabled: data.enabled === true,
      featured: data.featured === true,
      weight: Number(data.weight ?? 1),
      minSourceValue: data.minSourceValue == null ? undefined : Number(data.minSourceValue),
      maxSourceValue: data.maxSourceValue == null ? undefined : Number(data.maxSourceValue)
    } as UpgraderTarget;
  });
};

export const attemptUpgrade = async (payload: { sourceItemInstanceId: string; targetItemId: string; clientSeed?: string }) => {
  const response = await authedFetch('/api/attempt-upgrade', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Upgrade attempt failed.');
  }

  return response.json();
};
