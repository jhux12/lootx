import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { fromShippoAddress, interpretShippoValidation, normalizeAddress, toShippoAddress, validateLocalAddress } from '../_lib/shippingAddress.js';

const attempts = new Map();
const RATE_WINDOW_MS = 60_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Method Not Allowed' }); }
  try {
    const token = getBearerToken(req); if (!token) return sendJson(res, 401, { error: 'Authentication required' });
    const { uid } = await adminAuth.verifyIdToken(token);
    const now = Date.now(); const recent = (attempts.get(uid) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length >= 8) return sendJson(res, 429, { error: 'Please wait before checking another address.' });
    attempts.set(uid, [...recent, now]);
    const originalAddress = normalizeAddress((await readJsonBody(req))?.address);
    const messages = validateLocalAddress(originalAddress);
    if (messages.length) {
      console.warn('Address validation rejected locally', { countryCode: originalAddress.countryCode || null, attempted: false, outcome: 'invalid', messages });
      return sendJson(res, 400, { status: 'invalid', originalAddress, messages });
    }

    let result = { status: originalAddress.countryCode === 'US' ? 'unavailable' : 'inconclusive', originalAddress, messages: [originalAddress.countryCode === 'US' ? 'Verification is temporarily unavailable.' : "We couldn't fully verify this address with the carrier. Please confirm that it is correct before continuing."], provider: 'shippo' };
    const apiToken = process.env.SHIPPO_API_TOKEN;
    if (apiToken) {
      try {
        const response = await fetch('https://api.goshippo.com/addresses', { method: 'POST', headers: { Authorization: `ShippoToken ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...toShippoAddress(originalAddress), validate: true }), signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const data = await response.json(); const validation = data.validation_results ?? {}; const suggestedAddress = fromShippoAddress(data, originalAddress);
          const changed = ['street1','street2','city','state','postalCode','countryCode'].some((key) => String(originalAddress[key] ?? '').toLowerCase() !== String(suggestedAddress[key] ?? '').toLowerCase());
          const interpreted = interpretShippoValidation({ validation, countryCode: originalAddress.countryCode, changed });
          result = { status: interpreted.status, originalAddress, ...(interpreted.status === 'corrected' ? { suggestedAddress } : {}), messages: interpreted.messages.map((m) => m?.text ?? String(m)).filter(Boolean).slice(0, 5), provider: 'shippo', shippoAddressId: typeof data.object_id === 'string' ? data.object_id : null };
        } else {
          console.warn('Shippo address validation request failed', { countryCode: originalAddress.countryCode, attempted: true, httpStatus: response.status, outcome: result.status });
        }
      } catch (error) { console.warn('Shippo address validation unavailable', { countryCode: originalAddress.countryCode, attempted: true, error: error?.name, outcome: result.status }); }
    }
    console.info('Shippo address validation completed', { countryCode: originalAddress.countryCode, attempted: Boolean(apiToken), providerValid: result.status === 'valid' || result.status === 'corrected', outcome: result.status, messages: result.messages });
    const ref = firestore.collection('users').doc(uid).collection('addressValidationAttempts').doc();
    await ref.set({ ...result, createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: now + 15 * 60_000 });
    const { shippoAddressId: _privateId, ...publicResult } = result;
    return sendJson(res, 200, { ...publicResult, attemptId: ref.id });
  } catch (error) {
    console.error('address validation unavailable', { name: error?.name });
    return sendJson(res, 503, { status: 'unavailable', messages: ['Verification is temporarily unavailable.'] });
  }
}
