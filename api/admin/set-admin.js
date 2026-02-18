import admin from 'firebase-admin';

const DEFAULT_UID = '1yim9jqZo9gxkSuKP6oHKbBySar2';

export const config = { runtime: 'nodejs' };

// One-time setup example:
// curl -X POST https://YOURDOMAIN.com/api/admin/set-admin \
//   -H "Content-Type: application/json" \
//   -H "x-admin-secret: YOUR_ADMIN_SETUP_SECRET" \
//   -d "{}"
//
// Client verification snippet:
// await auth.currentUser.getIdToken(true);
// const t = await auth.currentUser.getIdTokenResult();
// console.log(t.claims.admin);

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  }

  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount())
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SETUP_SECRET || secret !== process.env.ADMIN_SETUP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const uid = typeof body.uid === 'string' && body.uid.trim() ? body.uid.trim() : DEFAULT_UID;
    const adminValue = typeof body.admin === 'boolean' ? body.admin : true;

    await admin.auth().setCustomUserClaims(uid, { admin: adminValue });
    return res.status(200).json({ ok: true, uid, admin: adminValue });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
