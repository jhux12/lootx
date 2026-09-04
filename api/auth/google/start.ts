import crypto from 'node:crypto';

const OAUTH_STATE_COOKIE = 'pullz_google_oauth_state';

const isProduction = () => process.env.NODE_ENV === 'production';

const getAppUrl = () => process.env.APP_URL || 'https://ripza.gg';

const buildCookieHeader = (state: string) => {
  const maxAgeSeconds = 60 * 10;
  const secure = isProduction() ? '; Secure' : '';
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
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

  console.info('Google OAuth start');
  const state = crypto.randomBytes(32).toString('hex');
  res.setHeader('Set-Cookie', buildCookieHeader(state));

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
