<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Shipping address verification

Set the server-only `SHIPPO_API_TOKEN` deployment environment variable to enable live Shippo address validation. If it is absent or the provider is unavailable, locally valid addresses can still be saved as unvalidated. Never expose this value through a `NEXT_PUBLIC_` variable.

Set the optional server-only `GEOAPIFY_API_KEY` to show address suggestions while customers type. The profile form remains fully usable when autocomplete is not configured or temporarily unavailable.

View your app in AI Studio: https://ai.studio/apps/drive/1jzMWG_BfQY623gwFGCJsYGEdUw7rNcF9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the environment variables in `.env.local` (copy `.env.example`):
   - `VITE_GEMINI_API_KEY` — Gemini API key
3. Run the app:
   `npm run dev`

## Deploying to Vercel

1. Add the environment variables from `.env.example` to your Vercel project settings (only `VITE_GEMINI_API_KEY` is required; Firebase client config is baked into the build).
2. Deploy with the default Vercel build command (`npm run build`). The app outputs static assets to `dist` (configured in `vercel.json`).

## Upgrader configuration

### Firestore setup
- Create `settings/upgrader` with:
  - `enabled`, `edgeMultiplier`, `minChance`, `maxChance`, `minUpgradeRatio`, `cooldownMs`, `allowFromFreeBox`, `allowFromPromo`, `requireTargetHigherValue`, `maxTargetValue`, `categoriesEnabled`, `raritiesEnabled`, `serverSeed`, `serverSeedHash`.
- Create `upgraderTargets` documents with:
  - `name`, `imageUrl`, `coinValue`, `rarity`, `category`, `enabled`, `featured`, `weight`, `minSourceValue`, `maxSourceValue`.

### Runtime
- User flow is available at `/upgrader`.
- Upgrade execution is server-side at `POST /api/attempt-upgrade`.
- Requests must include Firebase bearer token and body:
  - `sourceItemInstanceId`, `targetItemId`, and optional `clientSeed`.

### Provably fair verification
- Hash input (uses the same user `provablyFair` server seed used by regular box openings):
  - `serverSeed:uid:clientSeed:nonce:targetItemId:sourceItemInstanceId`
- Roll conversion:
  - `parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF`
- Win condition:
  - `roll < computedChance`
- Each attempt is logged in `upgradeAttempts` including roll/chance/nonce/serverSeedHash snapshots.
- Upgrader no longer depends on `settings/upgrader.serverSeed`; it reuses `provablyFair/{uid}.serverSeed` for consistency with box openings.
