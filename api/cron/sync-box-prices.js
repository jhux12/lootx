import { deny, ok } from '../_utils/auth.js';
import { firestore } from '../_lib/firebaseAdmin.js';
import { syncBox } from '../_lib/boxPricingService.js';
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return deny(res, 405, 'METHOD_NOT_ALLOWED');
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return deny(res, 401, 'CRON_SECRET_REQUIRED');
  const snapshot = await firestore.collection('boxes').where('marketPricing.enabled', '==', true).limit(25).get();
  const results = [];
  for (const box of snapshot.docs) { try { const result = await syncBox(box.id, 'vercel-cron'); results.push({ boxId: box.id, updated: result.updated || 0, pending: result.preview?.rows?.filter((row) => row.requiresApproval).length || 0 }); } catch (error) { console.error('Box price sync failed', box.id, error?.message); results.push({ boxId: box.id, error: String(error?.message || 'failed').slice(0, 120) }); } }
  return ok(res, { processed: results.length, results });
}
