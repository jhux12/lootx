import { firestore } from '../_lib/firebaseAdmin.js';
import { deny, ok, requireAdmin } from '../_utils/auth.js';
import { timestampToMillis } from '../_lib/financialTransactions.js';

const DATE_PRESETS = {
  today: 1,
  '7d': 7,
  '30d': 30
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (value) => String(value ?? '').toLowerCase();

const belongsToDateRange = (createdAtMs, startMs, endMs) => {
  if (!createdAtMs) return true;
  if (startMs && createdAtMs < startMs) return false;
  if (endMs && createdAtMs > endMs) return false;
  return true;
};

const buildDateRange = ({ range, startDate, endDate }) => {
  if (range === 'custom') {
    const startMs = startDate ? Date.parse(startDate) : 0;
    const endMs = endDate ? Date.parse(endDate) + 24 * 60 * 60 * 1000 - 1 : 0;
    return {
      startMs: Number.isFinite(startMs) ? startMs : 0,
      endMs: Number.isFinite(endMs) ? endMs : 0
    };
  }

  const days = DATE_PRESETS[range] ?? 0;
  if (!days) return { startMs: 0, endMs: 0 };

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  return { startMs: start.getTime(), endMs: end.getTime() };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return deny(res, 405, 'METHOD_NOT_ALLOWED');

  try {
    await requireAdmin(req);

    const {
      filter = 'all',
      search = '',
      range = '30d',
      startDate = '',
      endDate = '',
      page = '1',
      pageSize = '25',
      sortBy = 'createdAt',
      sortDir = 'desc'
    } = req.query ?? {};

    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safePageSize = Math.min(100, Math.max(10, Math.floor(Number(pageSize) || 25)));
    const searchValue = String(search ?? '').trim().toLowerCase();
    const { startMs, endMs } = buildDateRange({ range: String(range), startDate: String(startDate), endDate: String(endDate) });

    const [usersSnap, finSnap, stripeCreditsSnap, shipmentsSnap, userTransactionsSnap] = await Promise.all([
      firestore.collection('users').get(),
      firestore.collection('financial_transactions').orderBy('createdAt', 'desc').limit(3000).get(),
      firestore.collection('stripe_credits').orderBy('createdAt', 'desc').limit(2000).get(),
      firestore.collection('shipments').orderBy('createdAt', 'desc').limit(2000).get(),
      firestore.collectionGroup('transactions').orderBy('createdAt', 'desc').limit(4000).get()
    ]);

    const usersById = new Map();
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      usersById.set(docSnap.id, {
        uid: docSnap.id,
        username: data.username ?? data.displayName ?? data.name ?? null,
        email: data.email ?? null
      });
    });

    const recordsByKey = new Map();
    const upsert = (record = {}) => {
      const key = String(record.id ?? `${record.type}_${record.source}_${record.stripeSessionId ?? ''}_${record.uid ?? ''}_${record.createdAtMs ?? Date.now()}`);
      if (!recordsByKey.has(key)) {
        recordsByKey.set(key, record);
      }
    };

    finSnap.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      const createdAtMs = timestampToMillis(data.createdAt ?? data.updatedAt);
      const user = usersById.get(data.uid) ?? {};
      upsert({
        id: docSnap.id,
        type: data.type ?? 'unknown',
        status: data.status ?? 'completed',
        uid: data.uid ?? null,
        username: data.username ?? user.username ?? null,
        email: data.email ?? user.email ?? null,
        stripeSessionId: data.stripeSessionId ?? null,
        paymentIntentId: data.paymentIntentId ?? null,
        stripeCustomerId: data.stripeCustomerId ?? null,
        dollarAmount: toNumber(data.dollarAmount),
        coinAmount: toNumber(data.coinAmount),
        itemName: data.itemName ?? null,
        itemId: data.itemId ?? null,
        source: data.source ?? null,
        notes: data.notes ?? null,
        boxName: data.boxName ?? null,
        createdAtMs,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null
      });
    });

    stripeCreditsSnap.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      const user = usersById.get(data.uid) ?? {};
      const createdAtMs = timestampToMillis(data.createdAt);
      upsert({
        id: `stripe_credit_${docSnap.id}`,
        type: 'stripe_topup',
        status: 'completed',
        uid: data.uid ?? null,
        username: user.username ?? null,
        email: user.email ?? null,
        stripeSessionId: docSnap.id,
        paymentIntentId: data.paymentIntentId ?? null,
        stripeCustomerId: data.stripeCustomerId ?? null,
        dollarAmount: toNumber(data.amountTotalCents, 0) / 100,
        coinAmount: toNumber(data.coins),
        source: 'stripe_credits',
        notes: data.packageId ? `Package ${data.packageId}` : null,
        createdAtMs,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null
      });
    });

    shipmentsSnap.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      const user = usersById.get(data.uid) ?? {};
      const createdAtMs = timestampToMillis(data.createdAt);
      upsert({
        id: `shipment_${docSnap.id}`,
        type: 'shipment_request',
        status: data.status ?? (data.shippingPaid ? 'paid' : 'pending'),
        uid: data.uid ?? null,
        username: user.username ?? null,
        email: user.email ?? null,
        stripeSessionId: data.stripeCheckoutSessionId ?? null,
        paymentIntentId: data.paymentIntentId ?? null,
        stripeCustomerId: data.stripeCustomerId ?? null,
        dollarAmount: toNumber(data.shippingCashAmountCents) / 100,
        coinAmount: -Math.abs(toNumber(data.shippingCost)),
        itemName: data.item?.name ?? null,
        itemId: data.inventoryId ?? null,
        source: data.shippingPaymentMethod ?? 'shipping',
        notes: data.shippingPaid ? 'Shipping paid' : 'Shipping pending',
        createdAtMs,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null
      });
    });

    userTransactionsSnap.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      const parentUserId = docSnap.ref.parent?.parent?.id ?? null;
      const user = usersById.get(parentUserId) ?? {};
      const typeRaw = String(data.type ?? 'unknown').toLowerCase();
      const createdAtMs = timestampToMillis(data.createdAt);
      upsert({
        id: `user_tx_${parentUserId}_${docSnap.id}`,
        type: typeRaw,
        status: data.status ?? 'completed',
        uid: parentUserId,
        username: user.username ?? null,
        email: user.email ?? null,
        stripeSessionId: data.sessionId ?? data.stripeSessionId ?? null,
        paymentIntentId: data.paymentIntentId ?? null,
        stripeCustomerId: data.customerId ?? null,
        dollarAmount: toNumber(data.dollarAmount),
        coinAmount: toNumber(data.amountCoins ?? data.creditCoins ?? data.coins ?? data.amount ?? 0),
        itemName: data.itemName ?? null,
        itemId: data.itemId ?? null,
        source: data.paymentMethod ?? data.source ?? 'user_transactions',
        notes: data.caseId ? `Case ${data.caseId}` : null,
        createdAtMs,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null
      });
    });

    const filterValue = String(filter);
    const filtered = Array.from(recordsByKey.values()).filter((record) => {
      if (!belongsToDateRange(record.createdAtMs, startMs, endMs)) return false;

      if (searchValue) {
        const haystack = [
          record.email,
          record.username,
          record.uid,
          record.stripeSessionId,
          record.paymentIntentId
        ].map((value) => String(value ?? '').toLowerCase());
        if (!haystack.some((value) => value.includes(searchValue))) return false;
      }

      const type = String(record.type ?? '').toLowerCase();
      const status = normalizeStatus(record.status);

      if (filterValue === 'topups') return type.includes('topup') || type.includes('deposit') || type.includes('stripe');
      if (filterValue === 'coins_spent') return type.includes('case_open') || type.includes('plinko') || type.includes('upgrade');
      if (filterValue === 'admin_adjustments') return type.includes('admin');
      if (filterValue === 'sell_backs') return type.includes('sell_back') || type.includes('sellback');
      if (filterValue === 'shipments') return type.includes('shipment');
      if (filterValue === 'keeps') return type.includes('inventory_keep') || type.includes('item_claim');
      if (filterValue === 'failed') return status.includes('fail') || status.includes('error');
      if (filterValue === 'pending') return status.includes('pending') || status.includes('open');
      if (filterValue === 'refunded') return status.includes('refund');
      return true;
    });

    const sorted = filtered.sort((a, b) => {
      const dir = String(sortDir) === 'asc' ? 1 : -1;
      const aValue = sortBy === 'dollarAmount' ? toNumber(a.dollarAmount) : sortBy === 'coinAmount' ? toNumber(a.coinAmount) : toNumber(a.createdAtMs);
      const bValue = sortBy === 'dollarAmount' ? toNumber(b.dollarAmount) : sortBy === 'coinAmount' ? toNumber(b.coinAmount) : toNumber(b.createdAtMs);
      return (aValue - bValue) * dir;
    });

    const total = sorted.length;
    const startIndex = (safePage - 1) * safePageSize;
    const rows = sorted.slice(startIndex, startIndex + safePageSize);

    const summary = sorted.reduce((acc, record) => {
      const type = String(record.type ?? '').toLowerCase();
      const status = normalizeStatus(record.status);
      const dollars = toNumber(record.dollarAmount);
      const coins = toNumber(record.coinAmount);

      if ((type.includes('topup') || type.includes('deposit') || type.includes('stripe')) && status.includes('complete')) {
        acc.totalTopUpRevenue += Math.max(0, dollars);
        acc.totalCoinsPurchased += Math.max(0, coins);
      }

      if (type.includes('case_open') || type.includes('plinko') || type.includes('upgrade') || type.includes('shipping_coin')) {
        acc.totalCoinsSpent += Math.max(0, Math.abs(coins));
      }

      if (type.includes('admin_credit') || type.includes('admin_adjustment') || (type.includes('bonus') && coins > 0)) {
        acc.totalCoinsGrantedManually += Math.max(0, coins);
      }

      if (type.includes('sell_back') || type.includes('sellback')) {
        acc.totalCoinsSoldBackToUsers += Math.max(0, coins);
      }

      if (type.includes('shipment') && (status.includes('pending') || status.includes('requested'))) {
        acc.totalPendingWithdrawalValue += Math.max(0, toNumber(record.dollarAmount));
      }

      if (type.includes('shipment') && status.includes('shipped')) {
        acc.totalShippedItemValue += Math.max(0, toNumber(record.dollarAmount));
      }

      if (type.includes('inventory_keep') || type.includes('item_claim')) {
        acc.inventoryKeepValue += Math.max(0, toNumber(record.dollarAmount));
      }

      if (status.includes('refund') || type.includes('chargeback')) {
        acc.refundValue += Math.max(0, toNumber(record.dollarAmount));
      }

      return acc;
    }, {
      totalTopUpRevenue: 0,
      totalCoinsPurchased: 0,
      totalCoinsSpent: 0,
      totalCoinsGrantedManually: 0,
      totalCoinsSoldBackToUsers: 0,
      totalPendingWithdrawalValue: 0,
      totalShippedItemValue: 0,
      inventoryKeepValue: 0,
      refundValue: 0
    });

    summary.estimatedLoss = summary.totalShippedItemValue + summary.inventoryKeepValue + summary.refundValue;
    summary.estimatedProfit = summary.totalTopUpRevenue + summary.totalPendingWithdrawalValue;
    summary.netMargin = summary.estimatedProfit - summary.estimatedLoss;

    return ok(res, {
      rows,
      total,
      page: safePage,
      pageSize: safePageSize,
      summary,
      explainers: {
        profit: 'Profit is derived from successful Stripe top-ups and pending withdrawal value recovery.',
        loss: 'Loss includes shipped item value, kept inventory liabilities, manual grants and refunds where present.'
      }
    });
  } catch (error) {
    const status = error?.status ?? 500;
    const message = error?.error ?? error?.message ?? 'FAILED_TO_LOAD_FINANCIAL_TRANSACTIONS';
    return deny(res, status, message);
  }
}
