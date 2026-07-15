import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from './_lib/http.js';
import { calculateAvailableBalance } from './_lib/promoCoins.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
    const decoded = await adminAuth.verifyIdToken(token);
    const userRef = firestore.collection('users').doc(decoded.uid);
    const result = await firestore.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const balance = await calculateAvailableBalance({ transaction, uid: decoded.uid, userData });
      transaction.set(userRef, { balance: balance.totalCoins, coins: balance.purchasedCoins }, { merge: true });
      return balance;
    });
    return sendJson(res, 200, {
      purchasedCoins: result.purchasedCoins,
      promoCoins: result.validPromoCoins,
      validPromoCoins: result.validPromoCoins,
      totalCoins: result.totalCoins,
      promoGrants: result.activePromoGrants.map((grant) => ({
        grantId: grant.grantId ?? grant.id,
        source: grant.source,
        amount: Number(grant.amount ?? 0),
        remainingAmount: Number(grant.remainingAmount ?? 0),
        createdAt: grant.createdAt?.toMillis?.() ?? Number(grant.createdAt ?? 0),
        expiresAt: grant.expiresAt,
        status: grant.status
      }))
    });
  } catch (error) {
    return sendJson(res, 500, { error: 'BALANCE_FAILED', message: error?.message ?? 'Unable to fetch balance.' });
  }
}
