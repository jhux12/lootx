# Mobile performance implementation notes

## Homepage data and listeners

The homepage now reads `boxSummaries` (8 mobile / 12 desktop) and performs one ordered, bounded `homepageWins` query (10 documents). It no longer reads up to eight complete `boxes` documents to invent Live Wins. Approved reviews and the below-fold leaderboard preview are lazy one-time reads. SEO, bonus, Stripe display, and rewards settings use deduplicated cached document reads.

Realtime listeners intentionally retained in the global game context are the authenticated user's profile/balance, inventory, and notifications. They start only after authentication and preserve immediate balance/inventory correctness. Route-specific game and admin listeners remain owned by their route components and clean up on unmount.

`homepageWins` needs no composite index: its single-field descending `timestamp` query uses Firestore's automatic single-field index. Deploy `firestore.rules`; public clients can read records but cannot write them. The trusted `api/open-case.js` path writes safe fields after the award transaction. A failed decorative write is logged and never affects the awarded item.

## Baseline (2026-07-27)

The production build was 71,131,006 bytes including static assets. Initial chunks were 227.10 kB main JS (67.11 kB gzip), 299.57 kB Firestore JS (74.75 kB gzip), 193.85 kB React JS (60.56 kB gzip), and 250.16 kB CSS (36.70 kB gzip). Static inspection found homepage startup reads for box summaries plus up to 8 full box documents, one reviews listener when near view, SEO/bonus/Stripe listeners, authenticated user/inventory/notification listeners, and below-fold rewards/leaderboard listeners. The case preview ran an infinite WAAPI transform; mobile Live Wins duplicated its array and updated React state every 2.4 seconds.

Remote Firebase images do not have a resizing service in this repository. Images now retain explicit card dimensions, async decoding, and off-screen lazy loading where used. Generating 160/320/800-pixel WebP or AVIF variants at upload time remains the required storage-side follow-up; Firebase Storage must not be assumed to resize originals.
