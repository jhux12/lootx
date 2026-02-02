import { GoogleGenAI } from '@google/genai';
import { readJsonBody, sendJson } from './_lib/http.js';
import { getSupportContext } from '../utils/supportRetrieval.ts';

type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

const buildHistory = (messages: ChatMessage[]) => {
  const trimmed = messages.filter((msg) => msg && typeof msg.text === 'string');
  const firstUserIndex = trimmed.findIndex((msg) => msg.role === 'user');
  const normalized = firstUserIndex > 0 ? trimmed.slice(firstUserIndex) : trimmed;

  return normalized.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
};

const buildSystemInstruction = (contextText: string) => `You are Pullz Support AI.
Use ONLY the provided SITE_CONTEXT to answer.
If the answer is not in SITE_CONTEXT, say you don't know and suggest checking the FAQ, Terms, or Support.
Do not invent features, prices, policies, or guarantees.
If the user asks for illegal, unsafe, or unrelated requests, refuse briefly.

SITE_CONTEXT:
${contextText}`;

export default async function handler(req: { method?: string }, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Missing GEMINI_API_KEY' });
  }

  const body = await readJsonBody(req as any);
  if (!body || !Array.isArray(body.messages)) {
    return sendJson(res, 400, { error: 'Invalid payload' });
  }

  const messages = body.messages.filter((msg: ChatMessage) => msg && msg.text);
  const lastUser = [...messages].reverse().find((msg: ChatMessage) => msg.role === 'user');
  if (!lastUser) {
    return sendJson(res, 400, { error: 'No user message found' });
  }

  const { contextText, sources } = getSupportContext(lastUser.text);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const history = buildHistory(messages);
    const historyForChat = history.slice(0, Math.max(0, history.length - 1));
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: buildSystemInstruction(contextText),
        temperature: 0.2
      },
      history: historyForChat
    });

    const response = await chat.sendMessage({ message: lastUser.text });
    const reply = response.text?.trim() || "I'm not sure. Please check the FAQ, Terms, or Support for details.";

    return sendJson(res, 200, { reply, usedSources: sources });
  } catch (error) {
    console.error('Support chat error', error);
    return sendJson(res, 500, { error: 'Failed to generate response' });
  }
}
