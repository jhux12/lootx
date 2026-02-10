import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { computeRoll, pickPrizeByWeight, randomSeed, sha256 } from './_lib/provablyFair.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { applyXpAwardInTransaction, computeXpAward, getXpSettings } from './_lib/xp.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';
const STARTER_COINS = 1000;

const normalizeSizes = (sizes = []) =>
  sizes
    .filter((size) => typeof size === 'string')
    .map((size) => size.trim())
    .filter(Boolean);

const pickRandomSize = (sizes = []) => sizes[Math.floor(Math.random() * sizes.length)];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    const boxId = body?.boxId;
    const isFree = body?.isFree === true;
    if (!boxId || typeof boxId !== 'string') {
      return sendJson(res, 400, { error: 'Missing boxId' });
    }

    const boxRef = firestore.collection('boxes').doc(boxId);
    const USER_BOX_EXPIRY_MS = 24 * 60 * 60 * 1000;
    const userRef = firestore.collection('users').doc(decoded.uid);
    const provablyRef = firestore.collection('provablyFair').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc();
    const openRef = firestore.collection('opens').doc();

    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const [boxSnap, userSnap, provablySnap] = await Promise.all([
        transaction.get(boxRef),
        transaction.get(userRef),
        transaction.get(provablyRef)
      ]);

      if (!boxSnap.exists) {
        throw { status: 404, error: 'Box not found', boxId };
      }

      const boxData = boxSnap.data() ?? {};
      if (boxData.isUserCreated && boxData.createdAt) {
        const createdAt = typeof boxData.createdAt.toMillis === 'function'
          ? boxData.createdAt.toMillis()
          : Number(boxData.createdAt);
        if (Number.isFinite(createdAt) && Date.now() - createdAt >= USER_BOX_EXPIRY_MS) {
          throw { status: 404, error: 'Box not found', boxId };
        }
      }
      const price = Number(boxData.price ?? 0);
      const rawSellBackRate = Number(
        boxData.sellBackRate ?? (boxData.isUserCreated ? 0.75 : 0.82)
      );
      const sellBackRate = Number.isFinite(rawSellBackRate)
        ? Math.min(1, Math.max(0, rawSellBackRate))
        : 0.8;
      const prizes = Array.isArray(boxData.items) ? boxData.items : (Array.isArray(boxData.prizes) ? boxData.prizes : []);
      if (!prizes.length) {
        throw { status: 400, error: 'Box has no prizes', boxId };
      }

      const provablyData = provablySnap.data() ?? {};
      let serverSeed = provablyData.serverSeed;
      if (!serverSeed) serverSeed = randomSeed();
      const serverSeedHash = provablyData.serverSeedHash ?? sha256(serverSeed);
      const clientSeed = typeof provablyData.clientSeed === 'string' && provablyData.clientSeed.trim().length
        ? provablyData.clientSeed
        : DEFAULT_CLIENT_SEED;
      const nonce = Number.isFinite(provablyData.nonce) ? Number(provablyData.nonce) : 0;

      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const rawCoins = userSnap.exists ? (userData.coins ?? userData.balance) : undefined;
      const hasCoins = Number.isFinite(Number(rawCoins));
      const currentCoins = hasCoins ? Number(rawCoins) : (userSnap.exists ? 0 : STARTER_COINS);

      if (!userSnap.exists) {
        transaction.set(userRef, {
          coins: currentCoins,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      if (currentCoins < price) {
        throw { status: 400, error: 'Insufficient coins', coins: currentCoins, price };
      }

      const { roll, rollHash, message } = computeRoll(serverSeed, clientSeed, nonce, boxId);
      const prize = pickPrizeByWeight(prizes, roll);
      const sizeOptions = normalizeSizes(prize.sizes ?? []);
      const selectedSize = sizeOptions.length ? pickRandomSize(sizeOptions) : null;
      const prizeValue = Number(prize.value ?? prize.price ?? 0);
      const newCoins = currentCoins - price;

      transaction.set(userRef, { coins: newCoins }, { merge: true });
      transaction.set(provablyRef, {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: nonce + 1
      }, { merge: true });

      const obtainedAt = admin.firestore.FieldValue.serverTimestamp();
      const inventoryPayload = {
        boxId,
        prizeId: prize.id ?? null,
        name: prize.name ?? 'Mystery Item',
        value: prizeValue,
        image: prize.image ?? '',
        rarity: prize.rarity ?? 'common',
        status: 'available',
        obtainedAt,
        sellBackRate,
        redeemable: prize.redeemable ?? true
      };
      if (selectedSize) {
        inventoryPayload.size = selectedSize;
      }
      transaction.set(inventoryRef, inventoryPayload);

      const openPayload = {
        uid: decoded.uid,
        boxId,
        price,
        prize: {
          id: prize.id ?? null,
          name: prize.name ?? 'Mystery Item',
          value: prizeValue,
          image: prize.image ?? '',
          rarity: prize.rarity ?? 'common',
          weight: Number(prize.weight ?? prize.chance ?? 0),
          redeemable: prize.redeemable ?? true,
          size: selectedSize || null
        },
        createdAt: obtainedAt,
        provablyFair: {
          serverSeedHash,
          clientSeed,
          nonce,
          roll
        }
      };
      transaction.set(openRef, openPayload);

      const settings = await getXpSettings(transaction);
      const shouldAwardForFree = settings.exclusions?.dailyFreeEarnsXp === true;
      const shouldAward = !isFree || shouldAwardForFree;
      if (shouldAward && (userData.isAdmin !== true || settings.exclusions?.adminOrTestSpinsEarnXp === true)) {
        const xpRule = isFree ? settings.earnRules?.dailyFree : settings.earnRules?.openCase;
        const xpAmount = computeXpAward({
          rule: xpRule,
          amountCoins: isFree ? 0 : price,
          bonusRules: settings.bonusRules
        });
        await applyXpAwardInTransaction({
          transaction,
          userRef,
          xpAmount,
          actionKey: isFree ? 'dailyFree' : 'openCase'
        });
      }

      responsePayload = {
        ok: true,
        price,
        prize: {
          ...prize,
          price: prizeValue,
          value: prizeValue,
          redeemable: prize.redeemable ?? true,
          size: selectedSize || undefined
        },
        sellBackRate,
        newCoins,
        inventoryId: inventoryRef.id,
        openId: openRef.id,
        provablyFair: {
          serverSeedHash,
          clientSeed,
          nonce,
          roll,
          rollHash,
          message
        }
      };
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to open case', ...error });
    }
    console.error('open-case error', error);
    return sendJson(res, 500, { error: 'Unable to open case' });
  }
}
