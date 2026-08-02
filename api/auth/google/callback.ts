import { adminAuth } from '../../_lib/firebaseAdmin.js';

const OAUTH_STATE_COOKIE = 'pullz_google_oauth_state';
const PRODUCTION_ORIGINS = new Set(['https://pullz.gg', 'https://www.pullz.gg']);
const VERCEL_PREVIEW_HOST_PATTERN = /^(?:pullzgg-mystery-boxes|lootx|pullz)(?:-[a-z0-9-]+)?\.vercel\.app$/i;

type GooglePayload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

const parseCookies = (cookieHeader = ''): Record<string, string> => (
  cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, current) => {
      const sep = current.indexOf('=');
      if (sep <= 0) return acc;
      const key = current.slice(0, sep);
      const value = current.slice(sep + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {} as Record<string, string>)
);

const clearStateCookie = () => `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

const getAppUrl = () => process.env.APP_URL || 'https://www.pullz.gg';

type OAuthStateCookie = { state: string; returnOrigin: string };

const parseStateCookie = (raw?: string): OAuthStateCookie | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OAuthStateCookie>;
    if (typeof parsed.state === 'string' && typeof parsed.returnOrigin === 'string') {
      return { state: parsed.state, returnOrigin: parsed.returnOrigin };
    }
  } catch {
    // Backward compatibility with the previous cookie format during deploys.
    return { state: raw, returnOrigin: getAppUrl() };
  }
  return null;
};

const isAllowedReturnOrigin = (origin: string | null | undefined) => {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return false;
    if (PRODUCTION_ORIGINS.has(parsed.origin)) return true;
    return VERCEL_PREVIEW_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
};

const getSafeReturnOrigin = (stateCookie: OAuthStateCookie | null) => (
  isAllowedReturnOrigin(stateCookie?.returnOrigin) ? stateCookie!.returnOrigin : getAppUrl()
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  console.info('Google OAuth callback received');
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const stateCookie = parseStateCookie(parseCookies(req.headers.cookie || '')[OAUTH_STATE_COOKIE]);
  const returnOrigin = getSafeReturnOrigin(stateCookie);

  if (!code || !state || !stateCookie?.state || state !== stateCookie.state) {
    console.error('Google OAuth state mismatch');
    res.setHeader('Set-Cookie', clearStateCookie());
    return res.redirect(`${returnOrigin}/login?error=google_state_invalid`);
  }

  console.info('Google OAuth state valid');
  res.setHeader('Set-Cookie', clearStateCookie());

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${returnOrigin}/login?error=google_oauth_config_missing`);
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!tokenResponse.ok) throw new Error(`Token exchange failed ${tokenResponse.status}`);
    const tokenJson = await tokenResponse.json() as { id_token?: string };
    if (!tokenJson.id_token) throw new Error('Missing ID token from Google');

    console.info('Google token exchange success');

    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenJson.id_token)}`);
    if (!tokenInfoResponse.ok) throw new Error(`tokeninfo failed ${tokenInfoResponse.status}`);
    const payload = await tokenInfoResponse.json() as GooglePayload & { aud?: string };

    if (payload.aud !== clientId) throw new Error('Invalid token audience');
    if (!payload.email || !payload.email_verified || !payload.sub) throw new Error('Google account email must be verified');

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(payload.email);
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          uid: `google:${payload.sub}`,
          email: payload.email,
          emailVerified: true,
          displayName: payload.name || undefined,
          photoURL: payload.picture || undefined
        });
      } else {
        throw error;
      }
    }

    if (!userRecord.providerData?.some((provider) => provider.providerId === 'google.com')
      || userRecord.displayName !== (payload.name || userRecord.displayName)
      || userRecord.photoURL !== (payload.picture || userRecord.photoURL)
      || userRecord.emailVerified !== true) {
      await adminAuth.updateUser(userRecord.uid, {
        displayName: payload.name || userRecord.displayName || undefined,
        photoURL: payload.picture || userRecord.photoURL || undefined,
        emailVerified: true
      });
    }

    const customToken = await adminAuth.createCustomToken(userRecord.uid, { provider: 'google' });
    console.info('Firebase custom token created');

    return res.redirect(`${returnOrigin}/login?customToken=${encodeURIComponent(customToken)}`);
  } catch (error) {
    console.error('Google OAuth callback failed', error);
    return res.redirect(`${returnOrigin}/login?error=google_oauth_failed`);
  }
}
