import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_UPGRADER_SETTINGS, UpgraderSettings, UpgraderTarget, normalizeUpgraderSettings, validateUpgraderSettings } from '../utils/upgrader';
import { sanitizeForFirestore } from '../utils/firestoreSanitize';

export const saveUpgraderSettings = async (settings: Partial<UpgraderSettings>) => {
  const normalized = normalizeUpgraderSettings({
    ...DEFAULT_UPGRADER_SETTINGS,
    ...settings
  });
  const validation = validateUpgraderSettings(normalized);
  if (!validation.ok) {
    throw new Error(validation.issues[0] ?? 'Unsafe upgrader settings.');
  }

  const payload: Record<string, unknown> = {
    ...normalized,
    serverSeed: deleteField(),
    updatedAt: Date.now()
  };

  if (typeof settings.serverSeedHash !== 'string') {
    delete payload.serverSeedHash;
  }

  await setDoc(doc(db, 'settings', 'upgrader'), sanitizeForFirestore(payload), { merge: true });
};

export const rotateServerSeed = async () => {
  const nextSeed = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nextSeed));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  await setDoc(doc(db, 'settings', 'upgrader'), {
    serverSeed: deleteField(),
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
  const settingsSnapshot = await getDoc(doc(db, 'settings', 'upgrader'));
  const settings = normalizeUpgraderSettings(settingsSnapshot.exists() ? settingsSnapshot.data() as Partial<UpgraderSettings> : undefined);
  const validation = validateUpgraderSettings(settings);
  if (!validation.ok) {
    throw new Error('Fix upgrader settings before saving targets: unsafe expected value cap.');
  }

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
