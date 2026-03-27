import { firestore } from '../_lib/firebaseAdmin.js';
import { sendJson } from '../_lib/http.js';

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return null;
};

const normalizeOption = (option, index) => {
  if (!option || typeof option !== 'object') return null;
  const id = typeof option.id === 'string' && option.id.trim() ? option.id.trim() : `option-${index + 1}`;
  const label = typeof option.label === 'string' ? option.label.trim() : '';
  if (!label) return null;

  return {
    id,
    label,
    voteCount: Math.max(0, Math.floor(Number(option.voteCount ?? 0)))
  };
};

const normalizePoll = (id, raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const options = Array.isArray(raw.options)
    ? raw.options
        .map((entry, index) => normalizeOption(entry, index))
        .filter(Boolean)
    : [];

  return {
    id,
    title,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    rewardCoins: Math.max(0, Math.floor(Number(raw.rewardCoins ?? 0))),
    totalVotes: Math.max(0, Math.floor(Number(raw.totalVotes ?? 0))),
    active: raw.active !== false,
    published: raw.published !== false,
    endsAt: toMillis(raw.endsAt),
    createdAt: toMillis(raw.createdAt) ?? 0,
    options
  };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const snapshot = await firestore.collection('polls').orderBy('createdAt', 'desc').limit(50).get();

    const polls = snapshot.docs
      .map((docSnap) => normalizePoll(docSnap.id, docSnap.data()))
      .filter((poll) => !!poll)
      .filter((poll) => poll.active && poll.published && poll.options.length >= 2)
      .sort((a, b) => b.createdAt - a.createdAt);

    return sendJson(res, 200, { ok: true, polls });
  } catch (error) {
    console.error('Failed to list polls', error);
    return sendJson(res, 500, { ok: false, error: 'FAILED_TO_LIST_POLLS' });
  }
}
