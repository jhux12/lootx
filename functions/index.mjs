import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { toBoxSummary } from '../utils/boxSummary.js';
initializeApp();
export const syncBoxSummary = onDocumentWritten('boxes/{boxId}', async (event) => {
  const target = getFirestore().collection('boxSummaries').doc(event.params.boxId);
  if (!event.data?.after.exists) return target.delete();
  return target.set(toBoxSummary(event.params.boxId, event.data.after.data()));
});
