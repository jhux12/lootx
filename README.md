<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1jzMWG_BfQY623gwFGCJsYGEdUw7rNcF9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the environment variables in `.env.local` (copy `.env.example`):
   - `VITE_GEMINI_API_KEY` — Gemini API key
   - Firebase client config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
3. Run the app:
   `npm run dev`

## Deploying to Vercel

1. Add the environment variables from `.env.example` to your Vercel project settings.
2. Deploy with the default Vercel build command (`npm run build`). The app outputs static assets to `dist` (configured in `vercel.json`).
