import { readJsonBody, sendJson } from './_lib/http.js';

const GOOGLE_PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places';

const getComponent = (components, type, useShortName = false) => {
  const component = components.find((item) => Array.isArray(item.types) && item.types.includes(type));
  return component ? (useShortName ? component.shortText : component.longText) || '' : '';
};

const mapAddress = (components = [], formattedAddress = '') => {
  const streetNumber = getComponent(components, 'street_number');
  const route = getComponent(components, 'route');
  const subpremise = getComponent(components, 'subpremise');
  const city = getComponent(components, 'locality') || getComponent(components, 'postal_town') || getComponent(components, 'sublocality');
  const state = getComponent(components, 'administrative_area_level_1', true);
  const zip = getComponent(components, 'postal_code');
  const zipSuffix = getComponent(components, 'postal_code_suffix');
  const country = getComponent(components, 'country');

  return {
    street: [streetNumber, route].filter(Boolean).join(' ') + (subpremise ? ` #${subpremise}` : ''),
    city,
    state,
    zipCode: [zip, zipSuffix].filter(Boolean).join('-'),
    country,
    formattedAddress
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return sendJson(res, 500, { error: 'GOOGLE_PLACES_CONFIG_MISSING' });

  const body = await readJsonBody(req);
  if (!body) return sendJson(res, 400, { error: 'INVALID_JSON' });

  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : undefined;
  if (!placeId || !/^[A-Za-z0-9_:-]+$/.test(placeId)) return sendJson(res, 400, { error: 'INVALID_PLACE_ID' });

  try {
    const url = new URL(`${GOOGLE_PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`);
    url.searchParams.set('languageCode', 'en');
    url.searchParams.set('regionCode', 'us');
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

    const googleRes = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,formattedAddress,addressComponents'
      }
    });
    const payload = await googleRes.json().catch(() => ({}));
    if (!googleRes.ok) {
      console.error('Google Places details failed', googleRes.status, payload);
      return sendJson(res, googleRes.status, { error: 'GOOGLE_PLACE_DETAILS_FAILED' });
    }

    return sendJson(res, 200, { address: mapAddress(payload.addressComponents, payload.formattedAddress) });
  } catch (error) {
    console.error('Google Places details proxy error', error);
    return sendJson(res, 500, { error: 'GOOGLE_PLACE_DETAILS_ERROR' });
  }
}
