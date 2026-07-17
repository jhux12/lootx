import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { computeRoll, pickPrizeByWeight, randomSeed, sha256 } from './_lib/provablyFair.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { appendLedgerEntry } from './_lib/ledger.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';
import { loadEligibleBuildBoxItems, buildQuote } from './_lib/buildBox.js';

const DEFAULT_CLIENT_SEED = 'pullz-player';
const sanitize = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed.' });
  try {
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'AUTH_REQUIRED', message: 'Please log in to build a box.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    const selectedItemIds = Array.isArray(body?.selectedItemIds) ? body.selectedItemIds.filter((id) => typeof id === 'string') : [];
    const operationId = typeof body?.operationId === 'string' && body.operationId ? body.operationId : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userRef = firestore.collection('users').doc(decoded.uid);
    const provablyRef = firestore.collection('provablyFair').doc(decoded.uid);
    const openRef = firestore.collection('opens').doc();
    const inventoryRef = userRef.collection('inventory').doc();
    const processedOpRef = userRef.collection('processedBuildBoxOps').doc(operationId);
    let payload;
    await firestore.runTransaction(async (transaction) => {
      const [userSnap, provablySnap, processedSnap] = await Promise.all([transaction.get(userRef), transaction.get(provablyRef), transaction.get(processedOpRef)]);
      if (processedSnap.exists) throw Object.assign(new Error('This Build a Box operation was already processed.'), { status: 409, error: 'ALREADY_PROCESSED' });
      const { settings, items } = await loadEligibleBuildBoxItems(selectedItemIds, transaction);
      const quote = buildQuote(items, settings);
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const currentCoins = Number.isFinite(Number(userData.coins ?? userData.balance)) ? Number(userData.coins ?? userData.balance) : 0;
      if (currentCoins < quote.price) throw Object.assign(new Error('Not enough coins to build this box.'), { status: 402, error: 'INSUFFICIENT_FUNDS', price: quote.price, coins: currentCoins });
      const pf = provablySnap.exists ? provablySnap.data() ?? {} : {};
      const serverSeed = pf.serverSeed || randomSeed();
      const serverSeedHash = pf.serverSeedHash || sha256(serverSeed);
      const clientSeed = typeof pf.clientSeed === 'string' && pf.clientSeed.trim() ? pf.clientSeed : DEFAULT_CLIENT_SEED;
      const nonce = Number.isFinite(Number(pf.nonce)) ? Number(pf.nonce) : 0;
      const { roll, rollHash, message } = computeRoll(serverSeed, clientSeed, nonce, `build-box:${operationId}`);
      const prize = pickPrizeByWeight(quote.items, roll);
      const balanceResult = await recordBalanceChange({ transaction, uid: decoded.uid, userRef, userData: { ...userData, coins: currentCoins, balance: currentCoins }, currency: 'coins', amount: -quote.price, reason: 'build_box_open_cost', actorType: 'user', actorUid: decoded.uid, source: 'api/open-build-box', relatedId: openRef.id, metadata: { operationId, itemCount: quote.items.length } });
      transaction.set(provablyRef, { serverSeed, serverSeedHash, clientSeed, nonce: nonce + 1 }, { merge: true });
      const obtainedAt = admin.firestore.FieldValue.serverTimestamp();
      const inventoryPayload = { boxId: 'build-box', source: 'buildBox', prizeId: prize.originalId ?? prize.id, name: prize.name, value: Number(prize.value), image: prize.image, rarity: prize.rarity ?? 'common', status: 'available', obtainedAt, sellBackRate: 0.82, redeemable: prize.redeemable ?? true, forceFullSellBack: prize.forceFullSellBack === true };
      transaction.set(inventoryRef, sanitize(inventoryPayload));
      const openPayload = { uid: decoded.uid, boxId: 'build-box', boxName: 'Build a Box', price: quote.price, currencyType: 'COIN', paymentMethod: 'coins', buildBox: { itemIds: selectedItemIds, itemCount: quote.items.length, expectedValue: quote.expectedValue, targetRtp: quote.targetRtp, odds: quote.items.map((i) => ({ id: i.id, name: i.name, chance: i.chance, value: i.value, sourceBoxes: i.sourceBoxes })) }, prize: { id: prize.originalId ?? prize.id, name: prize.name, value: Number(prize.value), image: prize.image, rarity: prize.rarity ?? 'common', weight: Number(prize.weight ?? 0), chance: Number(prize.chance ?? 0) }, createdAt: obtainedAt, provablyFair: { serverSeedHash, clientSeed, nonce, roll } };
      transaction.set(openRef, openPayload);
      appendLedgerEntry({ transaction, userRef, userData, entry: { id: openRef.id, userId: decoded.uid, type: 'build_box_open', amount: -quote.price, createdAt: Date.now(), balanceAfter: balanceResult.balanceAfter, sourceId: openRef.id, memo: 'Built and opened a custom box' } });
      transaction.set(processedOpRef, { operationId, openId: openRef.id, inventoryId: inventoryRef.id, createdAt: obtainedAt });
      payload = { ok: true, price: quote.price, prize: { ...prize, price: Number(prize.value), value: Number(prize.value) }, newCoinBalance: balanceResult.balanceAfter, newCoins: balanceResult.balanceAfter, inventoryId: inventoryRef.id, openId: openRef.id, operationId, quote, provablyFair: { serverSeedHash, clientSeed, nonce, roll, rollHash, message } };
    });
    return sendJson(res, 200, payload);
  } catch (e) {
    return sendJson(res, e.status || 500, { ok: false, error: e.error || 'BUILD_BOX_OPEN_FAILED', message: e.message || 'Unable to open this custom box.', price: e.price, coins: e.coins });
  }
}
