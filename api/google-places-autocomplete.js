import { readJsonBody, sendJson } from './_lib/http.js';

const GOOGLE_PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'GOOGLE_PLACES_CONFIG_MISSING' });
  }

  const body = await readJsonBody(req);
  if (!body) return sendJson(res, 400, { error: 'INVALID_JSON' });

  const input = typeof body.input === 'string' ? body.input.trim() : '';
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : undefined;

  if (input.length < 3) return sendJson(res, 200, { suggestions: [] });
  if (input.length > 200) return sendJson(res, 400, { error: 'INPUT_TOO_LONG' });

  try {
    const googleRes = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text'
      },
      body: JSON.stringify({
        input,
        sessionToken,
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        includedRegionCodes: ['us'],
        languageCode: 'en',
        regionCode: 'us'
      })
    });

    const payload = await googleRes.json().catch(() => ({}));
    if (!googleRes.ok) {
      console.error('Google Places autocomplete failed', googleRes.status, payload);
      return sendJson(res, googleRes.status, { error: 'GOOGLE_PLACES_AUTOCOMPLETE_FAILED' });
    }

    const suggestions = (payload.suggestions || [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        placeId: prediction.placeId,
        text: prediction.text?.text || ''
      }))
      .filter((prediction) => prediction.placeId && prediction.text);

    return sendJson(res, 200, { suggestions });
  } catch (error) {
    console.error('Google Places autocomplete proxy error', error);
    return sendJson(res, 500, { error: 'GOOGLE_PLACES_AUTOCOMPLETE_ERROR' });
  }
}
