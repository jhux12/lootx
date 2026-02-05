const fallbackId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createIdempotencyKey = (prefix = 'action') => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${fallbackId()}`;
};
