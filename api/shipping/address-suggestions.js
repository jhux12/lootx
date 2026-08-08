import { adminAuth } from '../_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from '../_lib/http.js';

const requestHistory = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return sendJson(res, 405, { error: 'Method Not Allowed' }); }
  try {
    const token = getBearerToken(req); if (!token) return sendJson(res, 401, { error: 'Authentication required' });
    const { uid } = await adminAuth.verifyIdToken(token);
    const query = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
    const countryCode = typeof req.query?.countryCode === 'string' ? req.query.countryCode.trim().toLowerCase().slice(0, 2) : '';
    if (query.length < 3 || !/^[a-z]{2}$/.test(countryCode)) return sendJson(res, 200, { suggestions: [] });

    const now = Date.now(); const recent = (requestHistory.get(uid) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= 30) return sendJson(res, 429, { error: 'Please pause before searching again.' });
    requestHistory.set(uid, [...recent, now]);
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) return sendJson(res, 200, { suggestions: [], provider: 'unavailable' });

    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', query); url.searchParams.set('filter', `countrycode:${countryCode}`);
    url.searchParams.set('format', 'json'); url.searchParams.set('limit', '6'); url.searchParams.set('apiKey', apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return sendJson(res, 200, { suggestions: [], provider: 'unavailable' });
    const data = await response.json();
    const suggestions = (Array.isArray(data.results) ? data.results : []).map((item, index) => ({
      id: String(item.place_id ?? `${index}-${item.formatted ?? ''}`).slice(0, 180),
      label: String(item.formatted ?? '').slice(0, 240),
      address: {
        street1: String(item.address_line1 ?? [item.housenumber, item.street].filter(Boolean).join(' ')).slice(0, 160),
        street2: '', city: String(item.city ?? item.town ?? item.village ?? '').slice(0, 100),
        state: String(item.state_code ?? item.state ?? '').slice(0, 100), postalCode: String(item.postcode ?? '').slice(0, 32),
        countryCode: String(item.country_code ?? countryCode).toUpperCase().slice(0, 2)
      }
    })).filter((item) => item.label && item.address.street1);
    return sendJson(res, 200, { suggestions, provider: 'geoapify' });
  } catch (error) {
    console.error('address autocomplete unavailable', { name: error?.name });
    return sendJson(res, 200, { suggestions: [], provider: 'unavailable' });
  }
}
