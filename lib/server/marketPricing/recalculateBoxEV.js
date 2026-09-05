import { admin, db } from '../../../api/_lib/firebaseAdmin.js';

const valueCoinsForPrize = (item, latestItem) => {
  const candidate = latestItem || item || {};
  const value = candidate.valueCoins ?? candidate.price ?? candidate.value ?? item?.valueCoins ?? item?.price ?? item?.value ?? 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const probabilityForPrize = (item) => {
  const raw = Number(item?.probability ?? item?.chance ?? item?.weight ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const auditStatus = (marginPercent) => {
  if (marginPercent >= 0.25) return 'healthy';
  if (marginPercent >= 0.10) return 'warning';
  return 'danger';
};

export async function recalculateBoxesForItem(itemId) {
  const boxesSnapshot = await db.collection('boxes').get();
  const affected = [];

  for (const boxDoc of boxesSnapshot.docs) {
    const box = boxDoc.data() || {};
    const prizes = Array.isArray(box.items) ? box.items : Array.isArray(box.prizes) ? box.prizes : [];
    if (!prizes.some((prize) => String(prize?.id || prize?.itemId || '') === String(itemId))) continue;

    const itemRefs = prizes.map((prize) => String(prize?.id || prize?.itemId || '')).filter(Boolean);
    const latestItems = new Map();
    await Promise.all([...new Set(itemRefs)].map(async (id) => {
      try {
        const snap = await db.collection('items').doc(id).get();
        if (snap.exists) latestItems.set(id, snap.data());
      } catch (error) {
        console.error('Failed to load item for EV recalculation', id, error);
      }
    }));

    const expectedValueCoins = Math.round(prizes.reduce((sum, prize) => {
      const id = String(prize?.id || prize?.itemId || '');
      return sum + valueCoinsForPrize(prize, latestItems.get(id)) * probabilityForPrize(prize);
    }, 0));
    const boxPriceCoins = Math.max(0, Number(box.priceCoins ?? box.price ?? 0) || 0);
    const marginCoins = Math.round(boxPriceCoins - expectedValueCoins);
    const marginPercent = boxPriceCoins > 0 ? Math.round((marginCoins / boxPriceCoins) * 10000) / 10000 : 0;
    const status = auditStatus(marginPercent);
    const audit = {
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      expectedValueCoins,
      boxPriceCoins,
      marginCoins,
      marginPercent,
      status,
      needsReview: status === 'danger'
    };

    // TODO: If Ripza later standardizes a box disabled/status field, danger boxes can be safely paused here.
    await boxDoc.ref.set({ marketValueAudit: audit }, { merge: true });
    affected.push({ id: boxDoc.id, name: box.name || 'Mystery Pack', status, marginPercent });
  }

  return affected;
}
