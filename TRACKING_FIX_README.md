# Pullz.gg tracking repair

## What was fixed

- GA4 now passes the real client ID from the base `_ga` cookie into Stripe metadata. The prior code incorrectly treated GA4 session-cookie fields as the Measurement Protocol client ID.
- Meta Pixel now loads after `Accept all` consent instead of calling a no-op loader.
- Coin-package impressions and deliberate package selections are tracked.
- Checkout session creation, Stripe initialization, and redirect failures are tracked as `checkout_failed`.
- Explicit Stripe cancel returns are tracked as `checkout_return` plus `checkout_abandoned`.
- Pending checkout context survives the Stripe redirect in session storage.
- SPA `page_view` events use a short duplicate window, preventing React duplicate fires without suppressing legitimate repeat navigation for the rest of the session.
- Verified GA4 purchase/deposit events use individual retryable delivery records. Failed delivery is no longer permanently marked complete.
- Browser Meta event payloads no longer include raw email or Firebase user ID fields. Server CAPI continues to hash matching fields.

## Required Vercel environment variables

Set these for Production, Preview, and Development as appropriate:

```text
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=<server-only GA4 Measurement Protocol secret>
VITE_META_PIXEL_ID=<Meta dataset/pixel ID>
META_PIXEL_ID=<same Meta dataset/pixel ID>
META_CAPI_TOKEN=<server-only Meta CAPI token>
VITE_APP_ENV=production
```

Use `META_TEST_EVENT_CODE` only during Meta Test Events QA, then remove it.

Never prefix `GA4_API_SECRET` or `META_CAPI_TOKEN` with `VITE_`.

## Validation before production traffic

1. Deploy to Preview with Stripe test mode and the environment variables above.
2. Open the preview with `?ga_debug=1`, choose `Accept all`, and verify a single `page_view` in the console and GA4 DebugView.
3. Open Add Coins and verify `coin_package_view`; click a package and verify `coin_package_select`.
4. Start Stripe Checkout and verify one `begin_checkout` in GA4 and one deduplicated `InitiateCheckout` pair in Meta Test Events.
5. Cancel Stripe Checkout and verify `checkout_return` with status `cancel`, then `checkout_abandoned`.
6. Complete one Stripe test payment and verify:
   - one GA4 `purchase`
   - one GA4 `deposit_completed`
   - one GA4 `first_purchase` for a new payer
   - one Meta `Purchase` event deduplicated across Browser and Server
   - one Meta `FirstDeposit` for a new payer
7. Replay the Stripe webhook. Revenue events must not duplicate.
8. Complete a second deposit and verify `repeat_deposit` and `second_purchase`, without another `first_purchase` or `FirstDeposit`.

## Local validation

```bash
npm ci
npm test
npm run typecheck
npm run build
```

At handoff, all tracking tests, TypeScript validation, and the production build pass.
