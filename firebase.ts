import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const readEnv = (key: string) => {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  if (!value) return '';
  return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
};

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: readEnv('VITE_FIREBASE_DATABASE_URL'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID')
};

if (!firebaseConfig.apiKey) {
  console.error('Missing VITE_FIREBASE_API_KEY. Ensure your .env values are set and dev server is restarted.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const db = getFirestore(app);

export { auth, db, rtdb };
export default app;
