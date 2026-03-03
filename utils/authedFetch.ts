import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';

let authReadyPromise: Promise<User | null> | null = null;

const waitForAuthUser = (timeoutMs = 5000): Promise<User | null> => {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise<User | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      authReadyPromise = null;
      resolve(null);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      window.clearTimeout(timeout);
      unsubscribe();
      authReadyPromise = null;
      resolve(user);
    });
  });

  return authReadyPromise;
};

export const authedFetch = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
  const user = auth.currentUser ?? (await waitForAuthUser(5000));
  const token = await user?.getIdToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const responseText = await response.text();
    let payload: { error?: string; message?: string; details?: unknown } | null = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    const errorCode = payload?.error || 'REQUEST_FAILED';
    const details = payload?.details ? ` | details=${JSON.stringify(payload.details)}` : '';
    const message = payload?.message || responseText || `Request failed with status ${response.status}`;

    const error = new Error(`[${response.status} ${response.statusText}] ${errorCode}: ${message}${details}`) as Error & {
      status?: number;
      code?: string;
      payload?: unknown;
    };
    error.status = response.status;
    error.code = errorCode;
    error.payload = payload ?? responseText;
    throw error;
  }

  return response.json() as Promise<T>;
};
