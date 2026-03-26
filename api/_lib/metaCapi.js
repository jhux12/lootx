import crypto from 'node:crypto';

const META_API_VERSION = 'v23.0';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const isSha256Hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

const normalizeEmail = (email) => email.trim().toLowerCase();

const normalizePhone = (phone) => phone.trim().replace(/[^+\d]/g, '');

const maybeHash = (value, normalizer) => {
  if (!isNonEmptyString(value)) return undefined;
  const trimmed = value.trim();
  if (isSha256Hash(trimmed)) return trimmed.toLowerCase();
  const normalized = normalizer ? normalizer(trimmed) : trimmed;
  if (!normalized) return undefined;
  return hashValue(normalized);
};

const cleanObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const entries = Object.entries(value)
    .filter(([, fieldValue]) => fieldValue !== undefined && fieldValue !== null && fieldValue !== '')
    .map(([key, fieldValue]) => {
      if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
        return [key, cleanObject(fieldValue)];
      }
      return [key, fieldValue];
    })
    .filter(([, fieldValue]) => {
      if (!fieldValue || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) {
        return true;
      }
      return Object.keys(fieldValue).length > 0;
    });

  return Object.fromEntries(entries);
};

const pickClientIp = (req) => {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0];
  }
  if (typeof req?.socket?.remoteAddress === 'string') {
    return req.socket.remoteAddress;
  }
  return undefined;
};

export async function sendMetaEvent({
  req,
  event_name,
  event_id,
  event_source_url,
  user = {},
  custom_data,
  test_event_code
}) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;

  if (!pixelId || !token) {
    console.warn('meta-capi skipped: missing env vars', {
      hasPixelId: Boolean(pixelId),
      hasToken: Boolean(token),
      event_name,
      event_id
    });
    return { ok: false, skipped: true, reason: 'missing_env' };
  }

  const userData = cleanObject({
    em: maybeHash(user.email, normalizeEmail),
    ph: maybeHash(user.phone, normalizePhone),
    external_id: maybeHash(user.external_id),
    fbp: isNonEmptyString(user.fbp) ? user.fbp.trim() : undefined,
    fbc: isNonEmptyString(user.fbc) ? user.fbc.trim() : undefined,
    client_ip_address: pickClientIp(req),
    client_user_agent: req?.headers?.['user-agent']
  });

  const eventPayload = cleanObject({
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    action_source: 'website',
    event_source_url,
    user_data: userData,
    custom_data: cleanObject(custom_data)
  });

  const body = cleanObject({
    data: [eventPayload],
    test_event_code: isNonEmptyString(test_event_code) ? test_event_code.trim() : undefined
  });

  const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result?.error) {
      console.error('meta-capi request failed', {
        status: response.status,
        event_name,
        event_id,
        error: result?.error ?? result
      });
      return {
        ok: false,
        skipped: false,
        status: response.status,
        error: result?.error ?? result
      };
    }

    return {
      ok: true,
      skipped: false,
      status: response.status,
      events_received: result?.events_received
    };
  } catch (error) {
    console.error('meta-capi network error', {
      event_name,
      event_id,
      message: error?.message
    });
    return {
      ok: false,
      skipped: false,
      error: {
        message: error?.message ?? 'Unknown Meta CAPI error'
      }
    };
  }
}
