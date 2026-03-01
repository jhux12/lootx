import { adminAuth } from './_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from './_lib/http.js';
import { consumeRateLimit, getRateLimitKey } from './_utils/ratelimit.js';
import { getBearerToken } from './_utils/auth.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const parseOptionalUser = async (req) => {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
};

const callGemini = async (payload) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw { status: 500, error: 'GEMINI_API_KEY is not configured' };
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, error: data?.error?.message || 'Gemini request failed' };
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim() || '';
  return text;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const decoded = await parseOptionalUser(req);
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded?.uid ?? null, prefix: 'chat' }),
      limit: 10,
      windowMs: 60_000
    });
    if (!rateLimit.ok) {
      return sendJson(res, 429, { ok: false, error: 'Rate limit' });
    }

    const body = await readJsonBody(req);
    const mode = body?.mode === 'moderate' ? 'moderate' : 'assistant';

    if (mode === 'moderate') {
      const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 400) : '';
      if (!message) return sendJson(res, 400, { ok: false, error: 'Missing message' });

      const text = await callGemini({
        contents: [{ role: 'user', parts: [{ text: `You are a safety filter that only returns JSON. If acceptable: {"safe":true,"sanitizedText":"original message"}. If unsafe: {"safe":false,"reason":"brief reason","sanitizedText":"message with unsafe words replaced by asterisks"}. Always include sanitizedText. Message: """${message}"""` }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      let parsed;
      try {
        parsed = JSON.parse(text || '{}');
      } catch {
        parsed = { safe: true, sanitizedText: message };
      }

      return sendJson(res, 200, {
        ok: true,
        safe: parsed.safe !== false,
        reason: parsed.reason,
        sanitizedText: typeof parsed.sanitizedText === 'string' && parsed.sanitizedText.trim() ? parsed.sanitizedText.trim() : message
      });
    }

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 8000) : '';
    const systemInstruction = typeof body?.systemInstruction === 'string' ? body.systemInstruction.slice(0, 8000) : '';

    if (!prompt) {
      return sendJson(res, 400, { ok: false, error: 'Missing prompt' });
    }

    const answer = await callGemini({
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    return sendJson(res, 200, { ok: true, text: answer || "I'm having trouble connecting right now. Please try again." });
  } catch (error) {
    const status = error?.status || 500;
    return sendJson(res, status, { ok: false, error: error?.error || 'Chat request failed' });
  }
}
