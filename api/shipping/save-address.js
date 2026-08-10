import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { normalizeAddress, validateLocalAddress } from '../_lib/shippingAddress.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Method Not Allowed' }); }
  try {
    const token = getBearerToken(req); if (!token) return sendJson(res, 401, { error: 'Authentication required' });
    const { uid } = await adminAuth.verifyIdToken(token); const body = await readJsonBody(req);
    const attemptId = typeof body?.attemptId === 'string' ? body.attemptId : ''; const choice = body?.choice;
    if (!attemptId || !['original', 'suggested'].includes(choice)) return sendJson(res, 400, { error: 'Address verification is required.' });
    const attemptRef = firestore.collection('users').doc(uid).collection('addressValidationAttempts').doc(attemptId);
    const attemptSnap = await attemptRef.get(); const attempt = attemptSnap.data();
    if (!attemptSnap.exists || Number(attempt?.expiresAt) < Date.now()) return sendJson(res, 400, { error: 'Address verification expired. Please try again.' });
    if (attempt.status === 'invalid') return sendJson(res, 400, { error: 'Please edit the address before saving.' });
    const acceptedSuggestion = choice === 'suggested' && attempt.status === 'corrected' && attempt.suggestedAddress;
    const address = normalizeAddress(acceptedSuggestion ? attempt.suggestedAddress : attempt.originalAddress);
    if (validateLocalAddress(address).length) return sendJson(res, 400, { error: 'Please complete the required address fields.' });
    const isValidated = attempt.status === 'valid' || attempt.status === 'inconclusive' || Boolean(acceptedSuggestion);
    const savedAddress = { ...address, validated: isValidated, validationStatus: acceptedSuggestion ? 'corrected' : attempt.status === 'valid' ? 'valid' : attempt.status === 'inconclusive' ? 'inconclusive' : 'unvalidated', validatedAt: isValidated ? new Date().toISOString() : null, shippoAddressId: isValidated ? attempt.shippoAddressId ?? null : null };
    await firestore.collection('users').doc(uid).set({ shippingAddress: savedAddress, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await attemptRef.delete();
    return sendJson(res, 200, { address: savedAddress });
  } catch (error) { console.error('save-address error', { name: error?.name }); return sendJson(res, 500, { error: 'Unable to save address.' }); }
}
