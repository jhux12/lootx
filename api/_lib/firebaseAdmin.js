import admin from 'firebase-admin';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const parsedServiceAccount = serviceAccountKey
  ? JSON.parse(serviceAccountKey.replace(/\\n/g, '\n'))
  : null;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      parsedServiceAccount ?? {
        projectId,
        clientEmail,
        privateKey
      }
    )
  });
}

const adminAuth = admin.auth();
const firestore = admin.firestore();

export { admin, adminAuth, firestore };
