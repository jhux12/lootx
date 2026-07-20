# GA4 analytics implementation

## Audit and architecture

Before this change the application loaded Vercel Web Analytics lazily and Meta Pixel directly; neither is GA4. No Firebase Analytics, Google tag, GTM container, or GA4 Measurement Protocol implementation was present. Vercel Analytics remains product telemetry, while `services/analytics.ts` is the **only GA4 browser initialization path**. It loads `gtag.js` after explicit analytics consent and sends manual SPA views. Meta tracking is not used for GA4 events.

## Configuration and privacy

Set `VITE_GA4_MEASUREMENT_ID` for the browser and `GA4_MEASUREMENT_ID` plus `GA4_API_SECRET` only in Vercel server environment variables. Disable GA4 safely by omitting the client ID (browser events no-op) or either server value (webhook events no-op). `GA4_API_SECRET` must never be prefixed with `VITE_`.

Analytics honors the existing `cookieConsent=all` control. Payload keys matching PII are removed, URLs retain only origin/path, raw Firebase UIDs are not sent, and GA4 `user_id` is deliberately disabled until a consent-approved pseudonymous identity is designed. Privacy-policy copy should explicitly describe consented GA4 measurement and first-touch storage; legal text was intentionally not changed.

## Events and triggers

`page_view` follows logical app views. `sign_up_start` follows a meaningful email registration submission; `sign_up` and `login` follow successful Firebase calls. `view_item` is available through the typed module for box screens. `free_box_claim`, `box_open_start`, `box_open`, `item_won`, `sell_back`, and `item_kept` are wired around authoritative case actions. `begin_checkout` fires only after the API creates a Stripe Checkout Session. `checkout_return` is non-revenue only. `purchase` and `first_purchase` are Measurement Protocol events from a verified webhook, never the return page. `shipping_start` and `shipping_requested` are exposed for shipment-action integration.

All monetary `value`, `price`, and `*_usd` values are USD; coin values use explicit `*_coins`/`coin_*` names. The case UI conversion currently uses 100 coins per dollar only for analytics display estimates; confirmed purchase value always comes from Stripe cents.

## Attribution and deduplication

UTM/click identifiers are stored in `pullz_first_touch` once and `pullz_last_touch` for each non-direct tagged landing. Only safe fields, pathname, referrer hostname, and timestamp are retained. The client copies GA client ID and first-touch fields into Checkout metadata. The webhook uses Stripe session ID as `transaction_id` and creates `ga4_events/purchase_<session>` atomically before sending, preventing replayed webhook conversions. Client events with operation/session IDs are process-deduplicated to tolerate React Strict Mode/rerenders.

## Deployment and verification

Configure GA4 custom dimensions only for the low-cardinality parameters required for reporting (box type, free flag, checkout source, package ID, first-purchase attribution); mark `purchase` as a conversion in GA4. Use `?ga_debug=1` outside production or a non-production app environment to log sanitized events and set DebugView mode. Verify the checklist in the task: failed operations emit no outcome, webhook replay emits one purchase, and no payload contains PII. Build before deployment.

Known limitation: a user who blocks GA cookies has no server-side GA client ID, so their confirmed payment is intentionally not sent to GA4. Cash-paid shipping is confirmed by its Stripe webhook and is not reported as a client-side shipping confirmation.

Files changed: `services/analytics.ts`, client funnel components/context, Checkout API, Stripe webhook, `.env.example`.
