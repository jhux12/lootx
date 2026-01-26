import { auth } from '../firebase';

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

const parseJsonResponse = async (response: Response): Promise<JsonValue | null> => {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json();
};

export const authedFetch = async <T = JsonValue>(url: string, options: RequestInit = {}): Promise<T> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Missing auth token (no current user)', { url });
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  if (!token) {
    console.warn('Missing auth token', { url });
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const errorDetail = payload ? JSON.stringify(payload) : await response.text();
    throw new Error(errorDetail || `Request failed with status ${response.status}`);
  }

  return (payload ?? {}) as T;
};
