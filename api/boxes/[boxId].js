import { firestore } from '../_lib/firebaseAdmin.js';
import { sendJson } from '../_lib/http.js';
import { isPublicBoxDocument, mapPublicBoxDetails } from '../_lib/boxesPublic.js';

const BOX_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only GET is allowed for this endpoint.' });
  }

  const boxId = typeof req.query?.boxId === 'string' ? req.query.boxId : '';
  if (!BOX_ID_PATTERN.test(boxId)) {
    return sendJson(res, 400, { error: 'INVALID_BOX_ID', message: 'Invalid box identifier.' });
  }

  try {
    const docSnapshot = await firestore.collection('boxes').doc(boxId).get();

    if (!docSnapshot.exists || !isPublicBoxDocument(docSnapshot.data() || {})) {
      return sendJson(res, 404, { error: 'BOX_NOT_FOUND', message: 'Box not found.' });
    }

    return sendJson(res, 200, { box: mapPublicBoxDetails(docSnapshot) });
  } catch (error) {
    console.error('Failed to load box details', error?.message || error);
    return sendJson(res, 500, { error: 'BOX_DETAILS_FAILED', message: 'Unable to load box details.' });
  }
}
