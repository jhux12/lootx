#!/usr/bin/env node
import { getAdminDb } from '../api/_lib/firebaseAdmin.js';
import { toBoxSummary } from '../utils/boxSummary.js';
const db = getAdminDb();
let cursor; let written = 0;
do {
  let query = db.collection('boxes').orderBy('__name__').limit(250);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  const batch = db.batch();
  page.docs.forEach((box) => batch.set(db.collection('boxSummaries').doc(box.id), toBoxSummary(box.id, box.data()), { merge: true }));
  await batch.commit(); written += page.size; cursor = page.docs.at(-1);
  console.log(`Synced ${written} summaries`);
} while (cursor);
console.log(`Done: ${written} box summaries.`);
