import { type User } from 'firebase/auth';
import { auth } from '../firebase';

const waitForAuthUser = async (): Promise<User | null> => {
  if (auth.currentUser) return auth.currentUser;

  await auth.authStateReady();
  return auth.currentUser;
};

export const authedFetch = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
  const user = auth.currentUser ?? (await waitForAuthUser());
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
