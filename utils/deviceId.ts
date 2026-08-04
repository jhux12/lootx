const DEVICE_ID_KEY = 'pullz_device_id';

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const getDeviceId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const deviceId = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch {
    return null;
  }
};
