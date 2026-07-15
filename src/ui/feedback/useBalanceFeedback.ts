import { useEffect, useRef, useState } from 'react';
import { getBalanceDeltaTone, shouldPlayBalancePing } from './balanceFeedback';
import { useSound } from '../../../context/SoundContext';

const SIGN_IN_SOUND_SUPPRESSION_MS = 6000;
const SIGN_IN_SUPPRESSED_PINGS = 4;
const DAILY_SPIN_BALANCE_SUPPRESSION_KEY = 'pullzDailySpinSuppressBalanceFeedbackUntil';

export const useBalanceFeedback = (balance: number, isAuthenticated: boolean) => {
  const { muted, playSound } = useSound();
  const prevBalance = useRef(balance);
  const lastPlayAt = useRef(0);
  const wasAuthenticated = useRef(isAuthenticated);
  const suppressSoundUntil = useRef(0);
  const suppressedPingBudget = useRef(0);
  const [tone, setTone] = useState<'up' | 'down' | 'none'>('none');

  useEffect(() => {
    const signedInJustNow = isAuthenticated && !wasAuthenticated.current;
    wasAuthenticated.current = isAuthenticated;

    if (signedInJustNow) {
      suppressSoundUntil.current = Date.now() + SIGN_IN_SOUND_SUPPRESSION_MS;
      suppressedPingBudget.current = SIGN_IN_SUPPRESSED_PINGS;
      prevBalance.current = balance;
      return;
    }

    const suppressedUntil = (() => {
      if (typeof window === 'undefined') return 0;
      return Number(window.localStorage.getItem(DAILY_SPIN_BALANCE_SUPPRESSION_KEY) ?? 0);
    })();

    if (Number.isFinite(suppressedUntil) && Date.now() < suppressedUntil && balance !== prevBalance.current) {
      prevBalance.current = balance;
      return;
    }

    const delta = balance - prevBalance.current;
    const nextTone = getBalanceDeltaTone(delta);
    if (nextTone !== 'none') {
      setTone(nextTone);
      const inSignInSilenceWindow = Date.now() < suppressSoundUntil.current;
      const shouldSuppressByBudget = suppressedPingBudget.current > 0;
      if (shouldSuppressByBudget) {
        suppressedPingBudget.current -= 1;
      }

      if (!inSignInSilenceWindow && !shouldSuppressByBudget && shouldPlayBalancePing(muted, lastPlayAt.current)) {
        playSound('coins');
        lastPlayAt.current = Date.now();
      }
      const timer = window.setTimeout(() => setTone('none'), 420);
      return () => window.clearTimeout(timer);
    }
    prevBalance.current = balance;
  }, [balance, isAuthenticated, muted, playSound]);

  useEffect(() => {
    prevBalance.current = balance;
  }, [balance]);

  return tone;
};
