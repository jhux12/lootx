import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) return [];
  return options
    .map((entry, index) => {
      const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
      const id = typeof entry?.id === 'string' && entry.id.trim() ? entry.id : `option-${index + 1}`;
      if (!label) return null;
      return {
        id,
        label,
        voteCount: Math.max(0, Math.floor(Number(entry?.voteCount ?? 0)))
      };
    })
    .filter(Boolean);
};

const isPollExpired = (endsAt) => {
  if (endsAt == null) return false;
  const millis = typeof endsAt?.toMillis === 'function' ? endsAt.toMillis() : Number(endsAt);
  return Number.isFinite(millis) && millis > 0 && millis <= Date.now();
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });

  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'UNAUTHENTICATED' });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED' });
  }

  const body = await readJsonBody(req);
  const pollId = typeof body?.pollId === 'string' ? body.pollId.trim() : '';
  const optionId = typeof body?.optionId === 'string' ? body.optionId.trim() : '';
  if (!pollId || !optionId) {
    return sendJson(res, 400, { error: 'INVALID_INPUT', message: 'pollId and optionId are required.' });
  }

  try {
    const payload = await firestore.runTransaction(async (tx) => {
      const pollRef = firestore.collection('polls').doc(pollId);
      const userVoteRef = firestore.collection('userVotes').doc(decoded.uid).collection('polls').doc(pollId);
      const userRef = firestore.collection('users').doc(decoded.uid);

      const [pollSnap, userVoteSnap, userSnap] = await Promise.all([tx.get(pollRef), tx.get(userVoteRef), tx.get(userRef)]);
      if (!pollSnap.exists) throw new Error('Poll not found.');

      const pollData = pollSnap.data() ?? {};
      if (pollData.active === false || pollData.published === false) throw new Error('Poll is unavailable.');
      if (isPollExpired(pollData.endsAt)) throw new Error('Poll has expired.');

      const options = normalizeOptions(pollData.options);
      if (options.length < 2) throw new Error('Poll options are not configured.');

      if (userVoteSnap.exists) {
        const previousVote = userVoteSnap.data() ?? {};
        return {
          ok: true,
          pollId,
          selectedOptionId: previousVote.selectedOptionId ?? '',
          rewardCoins: Math.max(0, Math.floor(Number(previousVote.rewardCoins ?? 0))),
          alreadyVoted: true
        };
      }

      const targetIndex = options.findIndex((entry) => entry.id === optionId);
      if (targetIndex < 0) throw new Error('Selected option is invalid.');

      options[targetIndex] = {
        ...options[targetIndex],
        voteCount: options[targetIndex].voteCount + 1
      };

      const rewardCoins = Math.max(0, Math.floor(Number(pollData.rewardCoins ?? 0)));
      const totalVotes = Math.max(0, Math.floor(Number(pollData.totalVotes ?? 0))) + 1;

      tx.set(pollRef, {
        options,
        totalVotes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(userVoteRef, {
        uid: decoded.uid,
        pollId,
        selectedOptionId: optionId,
        rewardCoins,
        rewarded: true,
        createdAt: Date.now(),
        createdAtServer: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await recordBalanceChange({
        transaction: tx,
        uid: decoded.uid,
        userRef,
        userData: userSnap.exists ? userSnap.data() ?? {} : {},
        currency: 'coins',
        amount: rewardCoins,
        reason: 'poll_reward',
        actorType: 'system',
        actorUid: null,
        source: 'api/polls/vote',
        relatedId: pollId,
        metadata: { pollId, optionId }
      });
      tx.set(userRef, {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        ok: true,
        pollId,
        selectedOptionId: optionId,
        rewardCoins,
        alreadyVoted: false
      };
    });

    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 400, {
      error: 'POLL_VOTE_FAILED',
      message: error instanceof Error ? error.message : 'Unable to submit vote.'
    });
  }
}
