import { admin, firestore } from './firebaseAdmin.js';

const XP_SETTINGS_PATH = ['site', 'settings', 'xp'];

const DEFAULT_XP_SETTINGS = {
  earnRules: {
    openCase: {
      enabled: true,
      fixedXp: 15,
      percentPer100Coins: 0,
      perActionCap: null,
      perDayCap: null
    },
    dailyFree: {
      enabled: false,
      fixedXp: 10,
      percentPer100Coins: 0,
      perActionCap: null,
      perDayCap: null
    },
    sellItem: {
      enabled: true,
      fixedXp: 5,
      percentPer100Coins: 0,
      perActionCap: null,
      perDayCap: null
    },
    quest: {
      enabled: true,
      fixedXp: 0,
      percentPer100Coins: 0,
      perActionCap: null,
      perDayCap: null
    }
  },
  exclusions: {
    adminOrTestSpinsEarnXp: false,
    dailyFreeEarnsXp: false
  },
  bonusRules: [],
  ui: {
    showXpShop: true
  }
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeEarnRule = (rule, defaults) => ({
  enabled: rule?.enabled !== false,
  fixedXp: Math.max(0, Math.floor(toNumber(rule?.fixedXp, defaults.fixedXp))),
  percentPer100Coins: Math.max(0, toNumber(rule?.percentPer100Coins, defaults.percentPer100Coins)),
  perActionCap: rule?.perActionCap == null ? null : Math.max(0, Math.floor(toNumber(rule.perActionCap, 0))),
  perDayCap: rule?.perDayCap == null ? null : Math.max(0, Math.floor(toNumber(rule.perDayCap, 0)))
});

export const normalizeXpSettings = (data = {}) => {
  const earnRules = data?.earnRules ?? {};

  return {
    ...DEFAULT_XP_SETTINGS,
    ...data,
    earnRules: {
      openCase: normalizeEarnRule(earnRules.openCase, DEFAULT_XP_SETTINGS.earnRules.openCase),
      dailyFree: normalizeEarnRule(earnRules.dailyFree, DEFAULT_XP_SETTINGS.earnRules.dailyFree),
      sellItem: normalizeEarnRule(earnRules.sellItem, DEFAULT_XP_SETTINGS.earnRules.sellItem),
      quest: normalizeEarnRule(earnRules.quest, DEFAULT_XP_SETTINGS.earnRules.quest)
    },
    exclusions: {
      adminOrTestSpinsEarnXp: data?.exclusions?.adminOrTestSpinsEarnXp === true,
      dailyFreeEarnsXp: data?.exclusions?.dailyFreeEarnsXp === true
    },
    bonusRules: Array.isArray(data?.bonusRules) ? data.bonusRules : [],
    ui: {
      showXpShop: data?.ui?.showXpShop !== false
    }
  };
};

export const getXpSettingsRef = () =>
  firestore.collection(XP_SETTINGS_PATH[0]).doc(XP_SETTINGS_PATH[1]).collection(XP_SETTINGS_PATH[2]).doc('config');

export const getXpSettings = async (transaction = null) => {
  const ref = getXpSettingsRef();
  const snap = transaction ? await transaction.get(ref) : await ref.get();
  const normalized = normalizeXpSettings(snap.exists ? snap.data() : {});
  if (!snap.exists && !transaction) {
    await ref.set(normalized, { merge: true });
  }
  return normalized;
};

const getDateKey = () => new Date().toISOString().slice(0, 10);

export const computeXpAward = ({ rule, amountCoins = 0, bonusRules = [] }) => {
  if (!rule?.enabled) return 0;

  const fixed = Math.max(0, Math.floor(toNumber(rule.fixedXp, 0)));
  const percent = Math.max(0, toNumber(rule.percentPer100Coins, 0));
  let total = fixed + Math.floor((Math.max(0, toNumber(amountCoins, 0)) / 100) * percent);

  if (rule.perActionCap != null) {
    total = Math.min(total, Math.max(0, Math.floor(toNumber(rule.perActionCap, 0))));
  }

  for (const bonus of bonusRules) {
    if (!bonus?.enabled) continue;
    const now = Date.now();
    const startsAt = bonus.startAt ? new Date(bonus.startAt).getTime() : null;
    const endsAt = bonus.endAt ? new Date(bonus.endAt).getTime() : null;
    if (startsAt && now < startsAt) continue;
    if (endsAt && now > endsAt) continue;
    if (bonus.multiplier) {
      total = Math.floor(total * Math.max(0, toNumber(bonus.multiplier, 1)));
    }
    if (bonus.flatBonus) {
      total += Math.max(0, Math.floor(toNumber(bonus.flatBonus, 0)));
    }
  }

  return Math.max(0, Math.floor(total));
};

export const applyXpAwardInTransaction = async ({ transaction, userRef, xpAmount, actionKey }) => {
  const amount = Math.max(0, Math.floor(toNumber(xpAmount, 0)));
  if (!amount) return { awardedXp: 0 };

  const userSnap = await transaction.get(userRef);
  const userData = userSnap.exists ? userSnap.data() ?? {} : {};
  const currentXp = Math.max(0, Math.floor(toNumber(userData.xpBalance ?? userData.xp, 0)));
  const nextXp = currentXp + amount;

  const dateKey = getDateKey();
  const dailyCounters = { ...(userData.xpDailyEarned ?? {}) };
  dailyCounters[dateKey] = Math.max(0, Math.floor(toNumber(dailyCounters[dateKey], 0))) + amount;

  transaction.set(
    userRef,
    {
      xpBalance: nextXp,
      xp: nextXp,
      xpEarnedLifetime: Math.max(0, Math.floor(toNumber(userData.xpEarnedLifetime, 0))) + amount,
      xpDailyEarned: dailyCounters,
      lastXpAwardAction: actionKey,
      lastXpAwardAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { awardedXp: amount, xpBalance: nextXp };
};
