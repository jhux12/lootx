# Mobile performance deployment notes

## Baseline (2026-07-28)

The production build was 69 MB on disk, primarily because locally bundled profile PNGs include files between 1.6 MB and 4.2 MB. The initial JavaScript entry was 227.10 kB (67.11 kB gzip), CSS was 250.16 kB (36.70 kB gzip), and the lazy case-opening chunk was 78.63 kB (23.23 kB gzip).

Static inspection of a logged-out homepage found the box-summary query plus eight full `/boxes/{id}` reads used to manufacture Live Wins. It also found realtime listeners for SEO, approved reviews, bonus settings, Stripe display settings, and other global providers. Browser request counts cannot be reproduced without production Firebase credentials/data; the source-level request delta for Live Wins is eight full box reads removed and one bounded `homepageWins` query added. Initial images remain data-dependent remote URLs. Locally owned oversized profile images are not requested by the homepage unless used as a visible avatar.

The continuously active animations were the case preview WAAPI reel, mobile Live Wins interval/transform carousel, homepage hero rotation, and first-pull hero CSS orbit/slabs. The hero timer already pauses out of view/hidden/reduced-motion; the case preview and Live Wins mobile autoplay are now removed, and first-pull decoration is static below 768px and under Reduced Motion.

## Firestore data path and deployment

Deploy `firestore.rules` before or with the web build. No composite index is required: the only homepage query orders `homepageWins` by `timestamp` descending and limits to 10. The Admin SDK open-case endpoint writes only item name/image, box ID/name, rarity, timestamp, and the stable open ID. It writes after the award transaction and catches failures, so inventory delivery never depends on this decoration. Existing wins are not backfilled; the empty fixed-height state is expected until new opens arrive.

Realtime listeners intentionally retained are the authenticated user document (balance/profile), authenticated inventory, and authenticated notifications, because deposits, opens, keeps, sell-backs, and notification delivery require immediate correctness. Route-specific/admin listeners remain scoped to those mounted routes. Homepage reviews and SEO are now one-time reads; recent wins and box summaries use deduplicated caches. Bonus and Stripe settings listeners remain pending a coordinated cache-invalidation mechanism because stale checkout/reward configuration could affect business behavior.

## Images and remaining risks

Remote Firebase image URLs have no verified resizing extension or transformation service, so the client cannot honestly request generated 160/320/800 pixel variants. Images now used in Live Wins are explicit 96×96, asynchronously decoded, lazy loaded, and limited to six cards. A storage pipeline should generate AVIF/WebP variants at 160, 320, and 800 pixels and persist their URLs alongside source images. The largest remaining likely risks are: (1) oversized locally bundled profile PNGs (high deploy/cache footprint), (2) untransformed remote box/item images (high network and decode cost), and (3) remaining global settings listeners (low ongoing read/render cost, but sensitive to safe invalidation).
