import { firestore } from './firebaseAdmin.js';

const DEFAULT_ECONOMY_SETTINGS = {
  xpPerDollar: 250,
  coinsPerDollar: 100,
  xpOpenEnabled: true
};

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizeEconomySettings = (settings = {}) => ({
  xpPerDollar: toPositiveNumber(settings?.xpPerDollar, DEFAULT_ECONOMY_SETTINGS.xpPerDollar),
  coinsPerDollar: toPositiveNumber(settings?.coinsPerDollar, DEFAULT_ECONOMY_SETTINGS.coinsPerDollar),
  xpOpenEnabled: settings?.xpOpenEnabled !== false
});

export const getXpCost = (priceCoins, settings = DEFAULT_ECONOMY_SETTINGS) => {
  const normalized = normalizeEconomySettings(settings);
  const safePriceCoins = Number.isFinite(Number(priceCoins)) ? Math.max(0, Number(priceCoins)) : 0;
  if (safePriceCoins <= 0) return 0;
  return Math.max(1, Math.round((safePriceCoins / normalized.coinsPerDollar) * normalized.xpPerDollar));
};

export const getEconomySettingsRef = () => firestore.collection('settings').doc('economy');

export const getEconomySettings = async (transaction = null) => {
  const ref = getEconomySettingsRef();
  const snap = transaction ? await transaction.get(ref) : await ref.get();
  const normalized = normalizeEconomySettings(snap.exists ? snap.data() ?? {} : {});

  if (!snap.exists && !transaction) {
    await ref.set(normalized, { merge: true });
  }

  return { settings: normalized, ref, exists: snap.exists };
};

export { DEFAULT_ECONOMY_SETTINGS };
