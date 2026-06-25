import { firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';
import { isPublicBoxDocument, mapPublicBoxSummary, PUBLIC_BOX_SELECT_FIELDS, toSafeLimit } from './_lib/boxesPublic.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only GET is allowed for this endpoint.' });
  }

  try {
    const requestedLimit = toSafeLimit(req.query?.limit);
    const snapshot = await firestore
      .collection('boxes')
      .orderBy('price', 'asc')
      .orderBy('__name__', 'asc')
      .limit(requestedLimit)
      .select(...PUBLIC_BOX_SELECT_FIELDS)
      .get();

    const boxes = snapshot.docs
      .filter((doc) => isPublicBoxDocument(doc.data() || {}))
      .map(mapPublicBoxSummary);

    return sendJson(res, 200, { boxes, limit: requestedLimit });
  } catch (error) {
    console.error('Failed to load box summaries', error?.message || error);
    return sendJson(res, 500, { error: 'BOX_SUMMARIES_FAILED', message: 'Unable to load box summaries.' });
  }
}
