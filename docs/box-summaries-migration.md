# Box summary collection migration

Firestore cannot project fields from a document: reading an existing `boxes/{id}` document transfers embedded `items`/`prizes` even if the client ignores them. Deploy a trusted Admin SDK/Cloud Function trigger that writes `boxSummaries/{id}` whenever `boxes/{id}` changes. A summary must contain only catalog fields: name, price, priceXP, currencyType, image, accentColor, tag/tags, daily/pull-pass flags, createdAt, and optional precomputed preview values. It must never contain `items` or `prizes`.

After deployment, catalog/home queries should read `boxSummaries` with a cursor and load `boxes/{id}` only for the detail/open route. The current code uses a bounded 48-document legacy fallback for existing production data until that collection is populated; it cannot reduce the bytes of those legacy documents.


## Deployment

1. `cd functions && npm install && cd ..`
2. `firebase deploy --only functions:syncBoxSummary,firestore:rules`
3. Run `node scripts/backfillBoxSummaries.mjs` with the same Firebase Admin credentials used by the API.
4. Verify `boxSummaries` is populated, then set `VITE_ENABLE_LEGACY_BOX_FALLBACK=false` in a later rollout to remove the temporary legacy fallback.

The trigger is trusted server code; Firestore rules deliberately deny all client writes to summaries.


The default compatibility fallback is capped at 48 complete legacy documents and activates **only** after a successful empty `boxSummaries` query. It never activates after a network, permission, timeout, index, or query error. Mapping those documents to summaries protects UI data shape only; it does not reduce bytes transferred.
