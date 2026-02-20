import { auth } from '../firebase';

export const authedFetch = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
  const token = await auth.currentUser?.getIdToken();
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
    let payload: { error?: string; message?: string } | null = null;
    let responseText = '';
    try {
      payload = await response.json();
    } catch {
      try {
        responseText = await response.text();
      } catch {
        responseText = '';
      }
      payload = null;
    }

    const errorCode = payload?.error || 'REQUEST_FAILED';
    const message = payload?.message || responseText || `Request failed with status ${response.status}`;
    const error = new Error(`${errorCode}: ${message}`) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = errorCode;
    throw error;
  }

  return response.json() as Promise<T>;
};
