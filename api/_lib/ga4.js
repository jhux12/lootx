// Measurement Protocol is server-only. Never import this module into client code.
export const sendGa4Event = async ({ clientId, name, params }) => {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret || !clientId) return { skipped: true };
  const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, events: [{ name, params }] })
  });
  return { ok: response.ok, status: response.status };
};
