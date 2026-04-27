import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { appendLedgerEntry } from './_lib/ledger.js';
import { computeXpAward, getXpSettings } from './_lib/xp.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';

const isXpPurchasedInventoryItem = (inventoryItem = {}) => (
  inventoryItem.source === 'xpShop'
  || inventoryItem.acquisitionCurrencyType === 'XP'
  || inventoryItem.openCurrencyType === 'XP'
);

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DEFAULT_SELL_BACK_RATE = 0.8;

const buildError = (status, error, message, details = {}) => ({
  status,
  error,
  message,
  details
});

const toSellBackRate = (value, fallback = DEFAULT_SELL_BACK_RATE) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
};

const isItemSellableStatus = (status) => {
  const normalized = String(status ?? 'available').toLowerCase();
  return normalized === 'available';
};

const isXpItem = (inventoryItem = {}) => (
  inventoryItem.xpPurchased === true
  || inventoryItem.source === 'XP_SHOP'
  || inventoryItem.source === 'xpShop'
  || isXpPurchasedInventoryItem(inventoryItem)
);

const logSellError = ({ userId, itemId, reasonCode, item = {}, statusCode }) => {
  console.error('sell-item rejected', {
    statusCode,
    reasonCode,
    userId,
    itemId,
    itemStatus: item.status,
    redeemable: item.redeemable,
    redeemableForCoins: item.redeemableForCoins,
    coinValue: item.coinValue,
    value: item.value,
    xpPurchased: item.xpPurchased,
    source: item.source
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Missing bearer token.' });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (verifyError) {
      return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Invalid authentication token.' });
    }
    const body = await readJsonBody(req);
    const inventoryId = body?.inventoryId;

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc(inventoryId);

    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const inventorySnap = await transaction.get(inventoryRef);

      if (!inventorySnap.exists) {
        throw buildError(404, 'ITEM_NOT_FOUND', 'Inventory item not found.', {
          reasonCode: 'ITEM_NOT_FOUND',
          userId: decoded.uid,
          itemId: inventoryId
        });
      }

      const inventoryItem = inventorySnap.data() ?? {};
      if (inventoryItem.userId && inventoryItem.userId !== decoded.uid) {
        throw buildError(403, 'FORBIDDEN', 'Item does not belong to this user.', {
          reasonCode: 'ITEM_OWNERSHIP_MISMATCH',
          userId: decoded.uid,
          itemId: inventoryId,
          item: inventoryItem
        });
      }

      if (!isItemSellableStatus(inventoryItem.status)) {
        throw buildError(409, 'NOT_SELLABLE', 'Item cannot be sold in its current status.', {
          reasonCode: 'INVALID_STATUS',
          userId: decoded.uid,
          itemId: inventoryId,
          item: inventoryItem
        });
      }

      const isRedeemable = inventoryItem.redeemableForCoins ?? inventoryItem.redeemable;
      if (isRedeemable === false) {
        throw buildError(409, 'NOT_SELLABLE', 'Item is not redeemable for coins.', {
          reasonCode: 'NOT_REDEEMABLE',
          userId: decoded.uid,
          itemId: inventoryId,
          item: inventoryItem
        });
      }

      if (isXpItem(inventoryItem)) {
        throw buildError(409, 'NOT_SELLABLE', 'XP items cannot be sold back for coins.', {
          reasonCode: 'XP_ITEM',
          userId: decoded.uid,
          itemId: inventoryId,
          item: inventoryItem
        });
      }

      const coinValue = toFiniteNumber(inventoryItem.coinValue ?? inventoryItem.value ?? inventoryItem.price, NaN);
      if (!Number.isFinite(coinValue) || coinValue <= 0) {
        throw buildError(422, 'INVALID_VALUE', 'Item coin value is missing or invalid.', {
          reasonCode: 'INVALID_COIN_VALUE',
          userId: decoded.uid,
          itemId: inventoryId,
          item: inventoryItem
        });
      }
      const sellBackRate = toSellBackRate(inventoryItem.sellBackRate);
      const creditCoins = Math.floor(coinValue * sellBackRate);

      const currentCoins = toFiniteNumber(userSnap.data()?.coins ?? userSnap.data()?.balance ?? 0, 0);

      const settings = await getXpSettings(transaction);
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const xpAmount =
        (userData.isAdmin !== true || settings.exclusions?.adminOrTestSpinsEarnXp === true)
          ? computeXpAward({
            rule: settings.earnRules?.sellItem,
            amountCoins: creditCoins,
            bonusRules: settings.bonusRules
          })
          : 0;

      if (!userSnap.exists) {
        transaction.set(userRef, {
          coins: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const today = new Date().toISOString().slice(0, 10);
      const priorDay = typeof userData.challengeStatsDay === 'string' ? userData.challengeStatsDay : '';
      const priorStats = priorDay === today && userData.challengeStats && typeof userData.challengeStats === 'object'
        ? userData.challengeStats
        : {};
      const userPatch = {
        challengeStatsDay: today,
        challengeStats: {
          boxesOpened: Math.max(0, Number(priorStats.boxesOpened ?? 0)),
          sellBackItems: Math.max(0, Number(priorStats.sellBackItems ?? 0)) + 1,
          sellBackCoins: Math.max(0, Number(priorStats.sellBackCoins ?? 0)) + creditCoins,
          upgraderUses: Math.max(0, Number(priorStats.upgraderUses ?? 0)),
          rarityUnboxed: priorStats.rarityUnboxed ?? {}
        }
      };
      if (xpAmount > 0) {
        const currentXp = Math.max(0, Math.floor(toFiniteNumber(userData.xpBalance ?? userData.xp, 0)));
        const nextXp = currentXp + xpAmount;
        const dateKey = new Date().toISOString().slice(0, 10);
        const dailyCounters = { ...(userData.xpDailyEarned ?? {}) };
        dailyCounters[dateKey] = Math.max(0, Math.floor(toFiniteNumber(dailyCounters[dateKey], 0))) + xpAmount;

        userPatch.xpBalance = nextXp;
        userPatch.xp = nextXp;
        userPatch.xpEarnedLifetime = Math.max(0, Math.floor(toFiniteNumber(userData.xpEarnedLifetime, 0))) + xpAmount;
        userPatch.xpDailyEarned = dailyCounters;
        userPatch.lastXpAwardAction = 'sellItem';
        userPatch.lastXpAwardAt = admin.firestore.FieldValue.serverTimestamp();
      }

      const transactionRef = userRef.collection('transactions').doc();
      const { balanceAfter: newCoins } = await recordBalanceChange({
        transaction,
        uid: decoded.uid,
        currency: 'coins',
        amount: creditCoins,
        reason: 'sell_back_credit',
        actorType: 'user',
        actorUid: decoded.uid,
        source: 'api/sell-item',
        relatedId: inventoryRef.id,
        metadata: {
          itemName: inventoryItem.name ?? 'inventory item',
          sellBackRate,
          coinValue
        }
      });
      transaction.set(userRef, userPatch, { merge: true });
      appendLedgerEntry({
        transaction,
        userRef,
        userData,
        entry: {
          id: transactionRef.id,
          userId: decoded.uid,
          type: 'sell_back',
          amount: creditCoins,
          createdAt: Date.now(),
          balanceAfter: newCoins,
          sourceId: inventoryRef.id,
          memo: `Sold ${inventoryItem.name ?? 'inventory item'}`
        }
      });
      transaction.set(inventoryRef, {
        status: 'sold',
        soldAt: admin.firestore.FieldValue.serverTimestamp(),
        soldForCoins: creditCoins
      }, { merge: true });
      transaction.set(transactionRef, {
        type: 'SELL_BACK',
        itemId: inventoryRef.id,
        creditCoins,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      responsePayload = {
        ok: true,
        creditCoins,
        newCoins
      };
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status;
    if (status) {
      logSellError({
        userId: error?.details?.userId,
        itemId: error?.details?.itemId,
        reasonCode: error?.details?.reasonCode || error?.error || 'SELL_REJECTED',
        item: error?.details?.item,
        statusCode: status
      });
      return sendJson(res, status, {
        error: error.error || 'SELL_FAILED',
        message: error.message || 'Unable to sell item',
        reasonCode: error?.details?.reasonCode
      });
    }
    console.error('sell-item error', error);
    return sendJson(res, 500, {
      error: 'SELL_FAILED',
      message: 'Unexpected error while selling item.'
    });
  }
}
