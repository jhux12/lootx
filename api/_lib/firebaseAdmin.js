import admin from 'firebase-admin';

// Firebase Admin is intentionally NOT initialized from FIREBASE_SERVICE_ACCOUNT_KEY.
// Vercel env escaping can break JSON.parse for service-account blobs.
// Use FIREBASE_PRIVATE_KEY with literal "\n" sequences and convert via replace(/\\n/g, "\n").
// Vercel envs:
// - FIREBASE_PROJECT_ID=cases-e5b4e
// - FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@cases-e5b4e.iam.gserviceaccount.com
// - FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n
// Remove: FIREBASE_SERVICE_ACCOUNT_KEY

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env vars');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    })
  });

  console.info('Firebase Admin initialized');
}

const adminAuth = admin.auth();
const firestore = admin.firestore();
const db = firestore;

export { admin, adminAuth, firestore, db };
