import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { useVisibleInterval } from './useVisibleInterval';

const RAIN_DURATION_MS = 60 * 60 * 1000;
const RAIN_JOIN_BONUS = 10;
const MIN_ACCOUNT_AGE_MS = 10 * 60 * 1000;

const rainRef = doc(db, 'freeRain', 'current');

type FreeRainState = {
  cycleStartedAt: number;
  cycleEndsAt: number;
  potCoins: number;
  joinedUserIds: string[];
  lastPayoutAt?: number;
  lastPayoutPot?: number;
  lastPayoutParticipants?: number;
};

type JoinEligibility = {
  eligible: boolean;
  reason?: string;
};

type PayoutSummary = {
  payouts: Array<{ userId: string; amount: number }>;
  pot: number;
  participants: string[];
};

const createInitialState = (now: number): FreeRainState => ({
  cycleStartedAt: now,
  cycleEndsAt: now + RAIN_DURATION_MS,
  potCoins: 0,
  joinedUserIds: []
});

const normalizeRainState = (raw: Record<string, unknown> | undefined, now: number): FreeRainState => {
  if (!raw) {
    return createInitialState(now);
  }

  const startedAt = Number(raw.cycleStartedAt ?? now);
  const endsAt = Number(raw.cycleEndsAt ?? startedAt + RAIN_DURATION_MS);
  const potValue = Number(raw.potCoins ?? 0);
  const potCoins = Math.max(0, Number.isFinite(potValue) ? potValue : 0);
  const joinedUserIds = Array.isArray(raw.joinedUserIds)
    ? Array.from(new Set(raw.joinedUserIds.map((id) => String(id))))
    : [];

  return {
    cycleStartedAt: Number.isFinite(startedAt) ? startedAt : now,
    cycleEndsAt: Number.isFinite(endsAt) ? endsAt : now + RAIN_DURATION_MS,
    potCoins,
    joinedUserIds,
    lastPayoutAt: raw.lastPayoutAt ? Number(raw.lastPayoutAt) : undefined,
    lastPayoutPot: raw.lastPayoutPot ? Number(raw.lastPayoutPot) : undefined,
    lastPayoutParticipants: raw.lastPayoutParticipants ? Number(raw.lastPayoutParticipants) : undefined
  };
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const distributeRandomly = (pot: number, participants: string[]) => {
  if (pot <= 0 || participants.length === 0) return new Map<string, number>();
  const totalCoins = Math.max(0, Math.round(pot));
  const payoutsInCoins = new Map<string, number>();

  participants.forEach((userId) => payoutsInCoins.set(userId, 0));

  const randomized = shuffle(participants);
  for (let coin = 0; coin < totalCoins; coin += 1) {
    const recipient = randomized[Math.floor(Math.random() * randomized.length)];
    payoutsInCoins.set(recipient, (payoutsInCoins.get(recipient) ?? 0) + 1);
  }

  const payouts = new Map<string, number>();
  payoutsInCoins.forEach((amountCoins, userId) => {
    if (amountCoins > 0) {
      payouts.set(userId, amountCoins);
    }
  });

  return payouts;
};

export const useFreeRain = () => {
  const { user, isAuthenticated, setShowLoginModal, addNotification } = useGame();
  const [rainState, setRainState] = useState<FreeRainState>(() => createInitialState(Date.now()));
  const [isJoining, setIsJoining] = useState(false);
  const [now, setNow] = useState(Date.now());
  const finalizingRef = useRef(false);

  useVisibleInterval(() => setNow(Date.now()), 1000);

  useEffect(() => {
    const unsubscribe = onSnapshot(rainRef, (snapshot) => {
      const currentNow = Date.now();
      const normalized = normalizeRainState(snapshot.data(), currentNow);
      setRainState(normalized);
    }, (error) => {
      console.error('Free rain snapshot failed', error);
    });

    return () => unsubscribe();
  }, []);

  const finalizeCycle = useCallback(async (): Promise<PayoutSummary | null> => {
    if (finalizingRef.current) return null;
    finalizingRef.current = true;

    try {
      const summary = await runTransaction(db, async (transaction) => {
        const rainSnap = await transaction.get(rainRef);
        const currentNow = Date.now();

        if (!rainSnap.exists()) {
          const initialState = createInitialState(currentNow);
          transaction.set(rainRef, initialState, { merge: true });
          return null;
        }

        const state = normalizeRainState(rainSnap.data(), currentNow);
        if (currentNow < state.cycleEndsAt) {
          return null;
        }

        const participants = Array.from(new Set(state.joinedUserIds));
        const payouts = distributeRandomly(state.potCoins, participants);

        const payoutEntries = participants
          .map((userId) => ({ userId, payout: payouts.get(userId) }))
          .filter((entry): entry is { userId: string; payout: number } => Boolean(entry.payout));

        const userSnapshots = await Promise.all(
          payoutEntries.map(async ({ userId }) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);
            return { userId, userRef, userSnap };
          })
        );

        userSnapshots.forEach(({ userRef, userSnap, userId }) => {
          if (!userSnap.exists()) return;
          const payout = payouts.get(userId);
          if (!payout) return;
          const currentBalance = Number(userSnap.data().balance ?? 0);
          transaction.set(userRef, { balance: currentBalance + payout }, { merge: true });
        });

        const nextState: FreeRainState = {
          ...createInitialState(currentNow),
          lastPayoutAt: currentNow,
          lastPayoutPot: state.potCoins,
          lastPayoutParticipants: participants.length
        };

        transaction.set(rainRef, nextState, { merge: true });

        return {
          payouts: Array.from(payouts.entries()).map(([userId, amount]) => ({ userId, amount })),
          pot: state.potCoins,
          participants
        } satisfies PayoutSummary;
      });

      if (summary && summary.payouts.length > 0) {
        const mine = summary.payouts.find((entry) => entry.userId === user.id);
        if (mine && mine.amount > 0) {
          addNotification({
            type: 'success',
            message: `Free rain paid out ${mine.amount.toLocaleString()} coins.`
          });
        }
      }

      return summary ?? null;
    } finally {
      finalizingRef.current = false;
    }
  }, [addNotification, user.id]);

  useEffect(() => {
    void finalizeCycle();
  }, [finalizeCycle]);

  useVisibleInterval(() => {
    if (Date.now() >= rainState.cycleEndsAt) {
      void finalizeCycle();
    }
  }, 5000);

  const eligibility = useMemo<JoinEligibility>(() => {
    if (!isAuthenticated) {
      return { eligible: false, reason: 'Sign in to join free rain.' };
    }

    const accountCreatedAt = user.createdAt ?? now;
    const accountAge = now - accountCreatedAt;
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      const minutesLeft = Math.ceil((MIN_ACCOUNT_AGE_MS - accountAge) / 60000);
      return {
        eligible: false,
        reason: `Account must be 10 minutes old (${minutesLeft}m remaining).`
      };
    }

    return { eligible: true };
  }, [isAuthenticated, now, user.createdAt]);

  const joinRain = useCallback(async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (!eligibility.eligible) {
      addNotification({ type: 'info', message: eligibility.reason ?? 'Unable to join rain.' });
      return;
    }

    setIsJoining(true);

    try {
      await finalizeCycle();

      const result = await runTransaction(db, async (transaction) => {
        const rainSnap = await transaction.get(rainRef);
        const currentNow = Date.now();
        const baseState = rainSnap.exists()
          ? normalizeRainState(rainSnap.data(), currentNow)
          : createInitialState(currentNow);
        const needsReset = currentNow >= baseState.cycleEndsAt;
        const state = needsReset ? createInitialState(currentNow) : baseState;

        if (state.joinedUserIds.includes(user.id)) {
          return { joined: false, reason: 'Already joined this rain.' } as const;
        }

        const joinedUserIds = [...state.joinedUserIds, user.id];
        const potCoins = state.potCoins + RAIN_JOIN_BONUS;

        transaction.set(
          rainRef,
          {
            cycleStartedAt: state.cycleStartedAt,
            cycleEndsAt: state.cycleEndsAt,
            joinedUserIds,
            potCoins
          },
          { merge: true }
        );

        return { joined: true, potCoins } as const;
      });

      if (!result.joined) {
        addNotification({ type: 'info', message: result.reason ?? 'Unable to join rain.' });
        return;
      }

      addNotification({
        type: 'success',
        message: `Joined free rain. Pot is now ${result.potCoins.toLocaleString()} coins.`
      });
    } finally {
      setIsJoining(false);
    }
  }, [addNotification, eligibility, finalizeCycle, isAuthenticated, setShowLoginModal, user.id]);

  const joinCount = rainState.joinedUserIds.length;
  const isJoined = rainState.joinedUserIds.includes(user.id);
  const timeRemainingMs = Math.max(0, rainState.cycleEndsAt - now);

  return {
    potCoins: rainState.potCoins,
    joinCount,
    isJoined,
    isJoining,
    timeRemainingMs,
    eligibility,
    joinBonus: RAIN_JOIN_BONUS,
    rainDurationMs: RAIN_DURATION_MS,
    joinRain
  };
};
