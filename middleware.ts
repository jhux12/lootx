const MAINTENANCE_CACHE_MS = 3_000;

let cachedStatus: { enabled: boolean; expiresAt: number } | null = null;

const isOperationalRoute = (pathname: string) => (
  pathname.startsWith('/api/admin/')
  || pathname.startsWith('/api/auth/google/')
  || pathname === '/api/auth/restore-restricted-login'
  || pathname.startsWith('/api/cron/')
  || pathname === '/api/stripe-webhook'
  || pathname === '/api/cpx-postback'
);

const getMaintenanceStatus = async () => {
  const now = Date.now();
  if (cachedStatus && cachedStatus.expiresAt > now) return cachedStatus.enabled;

  const { firestore } = await import('./api/_lib/firebaseAdmin.js');
  const snapshot = await firestore.collection('site').doc('maintenance').get();
  const enabled = snapshot.exists && snapshot.data()?.enabled === true;
  cachedStatus = { enabled, expiresAt: now + MAINTENANCE_CACHE_MS };
  return enabled;
};

export default async function middleware(request: Request) {
  const { pathname } = new URL(request.url);
  if (isOperationalRoute(pathname)) return;

  try {
    if (!(await getMaintenanceStatus())) return;
  } catch (error) {
    // Fail open if Firestore is temporarily unavailable so middleware does not
    // become a second, accidental outage mechanism.
    console.error('Maintenance middleware status check failed', error);
    return;
  }

  return Response.json(
    { ok: false, error: 'SITE_MAINTENANCE', message: 'The site is currently under maintenance.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60'
      }
    }
  );
}

export const config = {
  matcher: '/api/:path*',
  runtime: 'nodejs'
};
