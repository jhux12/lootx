# GA4 implementation

## Architecture and funnel

```
Landing → page_view → sign_up_start → sign_up → free_box_claim → free_box_to_checkout
    → begin_checkout → [Stripe hosted Checkout] → verified webhook → purchase
    → first_purchase | deposit_completed | repeat_deposit → box_open_start → box_open
    → item_won → item_kept | sell_back → shipping_start → shipping_requested
```

`services/analytics.ts` is the only GA4 browser installation. It is consent-gated by the existing `cookieConsent=all` setting, injects `gtag.js` once, manually tracks logical SPA page views, rejects non-allowlisted names, removes PII-keyed fields, and session-deduplicates operation events. Vercel Analytics and Meta Pixel existed before this work and are not GA4 installations.

Client responsibilities are discovery/intent and successful UI actions. Server responsibilities are payment truth: `api/stripe-webhook.js` verifies Stripe signatures, credits the ledger, atomically records a GA idempotency marker, then calls Measurement Protocol. No client path sends GA4 `purchase`.

## Configuration and privacy

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_GA4_MEASUREMENT_ID` | browser | GA4 tag measurement ID |
| `GA4_MEASUREMENT_ID` | server | Measurement Protocol measurement ID |
| `GA4_API_SECRET` | server | Measurement Protocol secret; **never** `VITE_` prefixed |
| `VITE_APP_ENV` | browser | set `production` to disable automatic debug mode |

No email, address, phone, username, raw Firebase UID, customer object, or Stripe customer ID is sent. Product `item_name`/`box_name` are permitted ecommerce fields. URLs are reduced to origin/path. `user_id` is intentionally disabled until a consent-approved pseudonymous identity exists. Legal/privacy copy should disclose consented GA4 and local first/last-touch storage; it was not silently changed.

## Attribution and conversion units

`pullz_first_touch` is written only once and `pullz_last_touch` updates on later tagged landings. Both can contain UTM parameters, supported click IDs, Facebook campaign/ad set/ad, creative, placement, device category, landing pathname, referrer hostname, browser language, and country only if a future existing trusted source provides it. Nothing is copied to ordinary GA events; a safe subset is copied into trusted Checkout metadata for the webhook.

Coin-to-dollar conversion is centralized in `utils/economy.ts` and uses the same normalized `coinsPerDollar` economy setting as XP economics. Analytics must call `coinsToUsd`; never write a conversion constant. GA4 `value`/`price`/`*_usd` are dollars and use `currency: USD`; coin amounts use `coin_*` or `*_coins`. Confirmed package revenue always uses Stripe cents, not a UI price.

## Event reference

| Event | Origin / trigger | Key parameters |
| --- | --- | --- |
| `page_view` | logical SPA view change | title, location/path, app_view |
| `sign_up_start` | meaningful registration submission | method, location |
| `sign_up`, `login` | Firebase success only | method; signup referral/location |
| `view_item` | box visible, once per box/session | USD ecommerce item, box flags/prices |
| `free_box_claim` | authoritative free claim | box/item values |
| `box_open_start` | immediately before open request | box, coin/USD value, balance, entry point |
| `box_open`, `item_won` | authoritative response/inventory creation | operation ID, box/item/balance values |
| `sell_back`, `item_kept` | successful sell or keep resolution | item and safe value fields |
| `free_box_to_checkout` | Checkout Session after post-free-box flow | package/session ID |
| `begin_checkout` | Checkout Session returned, before redirect | USD package ecommerce item, coins, source |
| `checkout_return` | return URL only, non-revenue | status/session |
| `purchase`, `first_purchase` | verified Stripe webhook only | transaction ID, Stripe USD value, package/coins |
| `deposit_completed`, `repeat_deposit`, `second_purchase`, `third_purchase` | verified webhook only | trusted deposit number and purchase fields |
| `shipping_start`, `shipping_requested` | selected items / server shipment success | count, value, cost, safe shipment ID |
| `checkout_abandoned` | helper reserved for a future durable server timeout workflow; **not currently fired** | must use Checkout Session state, never a timer alone |

First purchase includes `days_since_signup`, `hours_since_signup`, `minutes_since_signup`, and `signup_to_purchase_seconds`, calculated only from Firebase Admin account `creationTime` and server receipt time.

## Deduplication and validation

Browser IDs are persisted in `sessionStorage`, so box views fire once per box per browser session despite rerenders/Strict Mode and fire again next session. Open, item, resolution, checkout, and shipping events use authoritative operation/session/inventory identifiers. Webhook purchase delivery uses `ga4_events/purchase_<Stripe session>` in a Firestore transaction; replayed Stripe webhooks cannot create another GA event.

The analytics abstraction validates event names, strips undefined/PII fields, sets DebugView payloads only in debug mode, and logs event name, ISO timestamp, dedupe key, sanitized payload, and skip reason. Measurement Protocol IDs and API secrets are never logged. Automated checks should assert allowed names, sanitizer behavior, session dedupe, operation dedupe, and webhook replay idempotency before expanding the funnel.

## QA, DebugView, and deployment

1. In a non-production environment grant Analytics consent and use `?ga_debug=1`; inspect concise `[GA4]` console records, then GA4 DebugView.
2. Open the same box repeatedly: one `view_item` per session; start a new browser session and confirm another view. Force an opening failure and confirm no outcome event.
3. In Stripe test mode create a Checkout Session, complete payment with a Stripe test card, verify exactly one webhook `purchase`, then replay the webhook and verify no second `ga4_events` marker/event. Confirm the first payment includes signup delay fields; later deposits emit repeat milestones only once.
4. Land with UTM/Facebook identifiers, inspect `pullz_first_touch`, revisit with a second tagged URL, and confirm first remains while last changes.
5. Before deploying configure all four variables, mark `purchase` (and only desired funnel events) as GA4 conversions, register only necessary low-cardinality custom dimensions, deploy, and rerun build/handler checks.

### Troubleshooting and common mistakes

* **No events:** verify consent and `VITE_GA4_MEASUREMENT_ID`; do not add Firebase Analytics/GTM as a second GA4 path.
* **No server purchase:** verify server-only `GA4_MEASUREMENT_ID`/`GA4_API_SECRET`, the signed webhook, and a GA cookie client ID captured before redirect. Cookie-blocked users intentionally have no Measurement Protocol client ID.
* **Duplicate revenue:** never send `purchase` from a success page; investigate the Firestore marker before manually replaying a webhook.
* **Incorrect currency:** do not use coin labels as dollars or a browser package price as confirmed revenue.
* **Abandonment:** do not emit it on modal close or a client timer. Implement it only after a server-side Checkout Session expiry/state check.

Files: `services/analytics.ts`, `utils/economy.ts`, Checkout/Stripe APIs, funnel components/context, `.env.example`.
