const normalizeIp = (value) => {
  if (typeof value !== 'string') return null;
  let ip = value.trim();
  if (!ip || ip.toLowerCase() === 'unknown') return null;

  // Proxies sometimes expose an IPv4 address as an IPv6-mapped value.
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice(7);
  // Remove brackets and an optional port from common socket address formats.
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, '');

  return ip.slice(0, 64) || null;
};

export const getClientIp = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwarded = typeof forwardedValue === 'string' ? forwardedValue.split(',')[0] : null;
  return normalizeIp(firstForwarded)
    ?? normalizeIp(req?.headers?.['x-real-ip'])
    ?? normalizeIp(req?.socket?.remoteAddress)
    ?? null;
};

export { normalizeIp };
