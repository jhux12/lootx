const buckets = new Map();

const getIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (typeof req.headers['x-real-ip'] === 'string') {
    return req.headers['x-real-ip'];
  }
  return 'unknown';
};

export const getRateLimitKey = ({ req, uid = null, prefix = 'global' }) => {
  return `${prefix}:${uid || getIp(req)}`;
};

export const consumeRateLimit = ({ key, limit = 30, windowMs = 60_000 }) => {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(0, current.resetAt - now), remaining: 0 };
  }

  current.count += 1;
  buckets.set(key, current);
  return { ok: true, remaining: Math.max(0, limit - current.count) };
};
