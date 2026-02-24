import { addDoc, collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_UPGRADER_SETTINGS, UpgraderSettings, UpgraderTarget, normalizeUpgraderSettings } from '../utils/upgrader';

export const saveUpgraderSettings = async (settings: Partial<UpgraderSettings>) => {
  await setDoc(doc(db, 'settings', 'upgrader'), {
    ...DEFAULT_UPGRADER_SETTINGS,
    ...settings,
    updatedAt: Date.now()
  }, { merge: true });
};

export const rotateServerSeed = async () => {
  const nextSeed = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nextSeed));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  await setDoc(doc(db, 'settings', 'upgrader'), {
    serverSeed: nextSeed,
    serverSeedHash: hash,
    seedRotatedAt: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });
  return hash;
};

export const listUpgraderTargetsAdmin = async () => {
  const snapshot = await getDocs(collection(db, 'upgraderTargets'));
  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() } as UpgraderTarget));
};

export const saveUpgraderTarget = async (target: Partial<UpgraderTarget> & { id?: string }) => {
  const payload = {
    name: String(target.name ?? ''),
    imageUrl: String(target.imageUrl ?? ''),
    coinValue: Number(target.coinValue ?? 0),
    rarity: String(target.rarity ?? 'common'),
    category: String(target.category ?? ''),
    enabled: target.enabled !== false,
    featured: target.featured === true,
    weight: Number(target.weight ?? 1),
    minSourceValue: target.minSourceValue == null ? null : Number(target.minSourceValue),
    maxSourceValue: target.maxSourceValue == null ? null : Number(target.maxSourceValue),
    updatedAt: Date.now()
  };

  if (target.id) {
    await setDoc(doc(db, 'upgraderTargets', target.id), payload, { merge: true });
    return target.id;
  }

  const created = await addDoc(collection(db, 'upgraderTargets'), payload);
  return created.id;
};

export const deleteUpgraderTarget = async (id: string) => deleteDoc(doc(db, 'upgraderTargets', id));
export { normalizeUpgraderSettings };
