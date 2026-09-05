import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (import.meta.env.DEV) {
  console.info('Firebase auth domain:', firebaseConfig.authDomain);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Keep the public catalogue and recent-pull feed available across reloads and
// short mobile network interruptions. Multiple-tab coordination prevents each
// open tab from maintaining an independent IndexedDB/network pipeline.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export { auth, db };
export default app;
