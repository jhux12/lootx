import crypto from 'node:crypto';

const OAUTH_STATE_COOKIE = 'pullz_google_oauth_state';
const PRODUCTION_ORIGINS = new Set(['https://pullz.gg', 'https://www.pullz.gg']);
const VERCEL_PREVIEW_HOST_PATTERN = /^(?:pullzgg-mystery-boxes|lootx|pullz)(?:-[a-z0-9-]+)?\.vercel\.app$/i;

const isProduction = () => process.env.NODE_ENV === 'production';

const getAppUrl = () => process.env.APP_URL || 'https://www.pullz.gg';

const getRequestOrigin = (req: any) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (!host) return null;
  return `${proto}://${host}`;
};

const isAllowedReturnOrigin = (origin: string | null) => {
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

const buildCookieHeader = (state: string, returnOrigin: string) => {
  const maxAgeSeconds = 60 * 10;
  const secure = isProduction() ? '; Secure' : '';
  const value = JSON.stringify({ state, returnOrigin });
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error('Google OAuth start missing env');
    return res.status(500).json({ error: 'GOOGLE_OAUTH_CONFIG_MISSING' });
  }

  const requestOrigin = getRequestOrigin(req);
  const returnOrigin = isAllowedReturnOrigin(requestOrigin) ? requestOrigin! : getAppUrl();

  console.info('Google OAuth start', { returnOrigin });
  const state = crypto.randomBytes(32).toString('hex');
  res.setHeader('Set-Cookie', buildCookieHeader(state, returnOrigin));

  const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  oauthUrl.searchParams.set('client_id', clientId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', 'openid email profile');
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('prompt', 'select_account');
  oauthUrl.searchParams.set('access_type', 'offline');

  return res.redirect(oauthUrl.toString());
}
