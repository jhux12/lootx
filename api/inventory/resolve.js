import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';

const normalizeAction = (action) => (action === 'sell' ? 'sell' : 'keep');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed.' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'AUTH_REQUIRED', message: 'Please log in to resolve items.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const body = await readJsonBody(req);
    const actions = Array.isArray(body?.actions) ? body.actions : [];
    const clientRequestId = typeof body?.clientRequestId === 'string' ? body.clientRequestId.trim() : '';

    if (!clientRequestId || actions.length === 0) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'actions and clientRequestId are required.' });
    }

    const uniqueActions = new Map();
    for (const rawAction of actions) {
      const itemId = typeof rawAction?.itemId === 'string' ? rawAction.itemId.trim() : '';
      if (!itemId) continue;
      uniqueActions.set(itemId, normalizeAction(rawAction?.action));
    }

    if (uniqueActions.size === 0) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'No valid item actions provided.' });
    }

    const userRef = firestore.collection('users').doc(uid);
    const idempotencyRef = firestore.collection('inventoryResolveRequests').doc(`${uid}_${clientRequestId}`);

    let responsePayload = null;

    await firestore.runTransaction(async (transaction) => {
      const [idemSnap, userSnap] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(userRef)
      ]);

      if (idemSnap.exists) {
        responsePayload = idemSnap.data()?.response ?? null;
        return;
      }

      if (!userSnap.exists) throw { status: 404, error: 'USER_NOT_FOUND', message: 'User account not found.' };

      const userData = userSnap.data() ?? {};
      const balance = Number(userData.coins ?? userData.balance ?? 0);
      const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0;

      const itemRefs = Array.from(uniqueActions.keys()).map((itemId) => userRef.collection('inventory').doc(itemId));
      const itemSnapshots = await Promise.all(itemRefs.map((itemRef) => transaction.get(itemRef)));

      let credited = 0;

      itemSnapshots.forEach((snap, index) => {
        if (!snap.exists) throw { status: 404, error: 'ITEM_NOT_FOUND', message: `Item ${itemRefs[index].id} not found.` };
        const data = snap.data() ?? {};

        if ((data.userId ?? uid) !== uid) throw { status: 403, error: 'FORBIDDEN', message: 'Item does not belong to this user.' };
        if (data.status !== 'pending_decision') {
          throw { status: 409, error: 'ITEM_ALREADY_RESOLVED', message: 'One or more items are no longer pending.' };
        }

        const action = uniqueActions.get(snap.id) ?? 'keep';
        if (action === 'sell') {
          const sellValue = Number(data.sellValueCoins ?? 0);
          credited += Number.isFinite(sellValue) ? Math.max(0, sellValue) : 0;
          transaction.set(snap.ref, {
            status: 'sold',
            decisionLocked: true,
            soldAt: admin.firestore.FieldValue.serverTimestamp(),
            soldForCoins: Number.isFinite(sellValue) ? Math.max(0, sellValue) : 0
          }, { merge: true });
        } else {
          transaction.set(snap.ref, {
            status: 'kept',
            decisionLocked: true,
            keptAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });

      const updatedBalance = safeBalance + credited;
      if (credited > 0) {
        transaction.set(userRef, { coins: updatedBalance, balance: updatedBalance }, { merge: true });
      }

      responsePayload = { credited, updatedBalance };

      transaction.set(firestore.collection('inventoryActions').doc(), {
        uid,
        clientRequestId,
        actions: Array.from(uniqueActions.entries()).map(([itemId, action]) => ({ itemId, action })),
        credited,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.set(idempotencyRef, {
        clientRequestId,
        uid,
        response: responsePayload,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return sendJson(res, 200, responsePayload ?? { credited: 0, updatedBalance: 0 });
  } catch (error) {
    return sendJson(res, Number(error?.status) || 500, {
      error: error?.error || 'INVENTORY_RESOLVE_FAILED',
      message: error?.message || 'Unable to resolve inventory actions.'
    });
  }
}
