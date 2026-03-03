import { useEffect, useRef, useState } from 'react';
import { getBalanceDeltaTone, shouldPlayBalancePing } from './balanceFeedback';
import { useSound } from '../../../context/SoundContext';

type BalanceFeedbackOptions = {
  isAuthenticated?: boolean;
  authSilenceMs?: number;
};

export const useBalanceFeedback = (balance: number, options: BalanceFeedbackOptions = {}) => {
  const { muted, playSound } = useSound();
  const { isAuthenticated = false, authSilenceMs = 1600 } = options;

  const prevBalance = useRef(balance);
  const lastPlayAt = useRef(0);
  const authSilencedUntilRef = useRef(0);
  const prevAuthRef = useRef(isAuthenticated);
  const [tone, setTone] = useState<'up' | 'down' | 'none'>('none');

  useEffect(() => {
    const justSignedIn = !prevAuthRef.current && isAuthenticated;
    prevAuthRef.current = isAuthenticated;
    if (justSignedIn) {
      authSilencedUntilRef.current = Date.now() + authSilenceMs;
      prevBalance.current = balance;
      return;
    }

    const delta = balance - prevBalance.current;
    const nextTone = getBalanceDeltaTone(delta);
    if (nextTone !== 'none') {
      setTone(nextTone);
      const audioAllowed = Date.now() >= authSilencedUntilRef.current;
      if (audioAllowed && shouldPlayBalancePing(muted, lastPlayAt.current)) {
        playSound('coins');
        lastPlayAt.current = Date.now();
      }
      const timer = window.setTimeout(() => setTone('none'), 420);
      return () => window.clearTimeout(timer);
    }
    prevBalance.current = balance;
  }, [authSilenceMs, balance, isAuthenticated, muted, playSound]);

  useEffect(() => {
    prevBalance.current = balance;
  }, [balance]);

  return tone;
};
