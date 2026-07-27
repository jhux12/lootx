const STORAGE_KEY = 'pullz_pending_checkout';

export type PendingCheckout = {
  sessionId: string;
  packageId: string;
  value: number;
  currency: 'USD';
  source: string;
  startedAt: number;
};

export const savePendingCheckout = (checkout: PendingCheckout) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkout));
  } catch {
    // Checkout still works when storage is unavailable.
  }
};

export const getPendingCheckout = (): PendingCheckout | null => {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null') as Partial<PendingCheckout> | null;
    if (!parsed || typeof parsed.sessionId !== 'string' || typeof parsed.packageId !== 'string') return null;
    return {
      sessionId: parsed.sessionId,
      packageId: parsed.packageId,
      value: Number(parsed.value) || 0,
      currency: 'USD',
      source: typeof parsed.source === 'string' ? parsed.source : 'top_up_modal',
      startedAt: Number(parsed.startedAt) || Date.now()
    };
  } catch {
    return null;
  }
};

export const clearPendingCheckout = (sessionId?: string) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getPendingCheckout();
    if (!sessionId || !current || current.sessionId === sessionId) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // No action is needed when storage is unavailable.
  }
};
