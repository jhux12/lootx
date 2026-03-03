import { useEffect, useRef, useState } from 'react';
import { getBalanceDeltaTone, shouldPlayBalancePing } from './balanceFeedback';
import { useSound } from '../../../context/SoundContext';

export const useBalanceFeedback = (balance: number, isAuthenticated: boolean) => {
  const { muted, playSound } = useSound();
  const prevBalance = useRef(balance);
  const lastPlayAt = useRef(0);
  const wasAuthenticated = useRef(isAuthenticated);
  const [tone, setTone] = useState<'up' | 'down' | 'none'>('none');

  useEffect(() => {
    const signedInJustNow = isAuthenticated && !wasAuthenticated.current;
    wasAuthenticated.current = isAuthenticated;

    if (!isAuthenticated || signedInJustNow) {
      prevBalance.current = balance;
      return;
    }

    const delta = balance - prevBalance.current;
    const nextTone = getBalanceDeltaTone(delta);
    if (nextTone !== 'none') {
      setTone(nextTone);
      if (shouldPlayBalancePing(muted, lastPlayAt.current)) {
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
