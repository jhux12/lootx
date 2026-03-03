import { useEffect, useRef, useState } from 'react';
import { getBalanceDeltaTone, shouldPlayBalancePing } from './balanceFeedback';
import { useSound } from '../../../context/SoundContext';

export const useBalanceFeedback = (balance: number) => {
  const { muted, playSound } = useSound();
  const prevBalance = useRef(balance);
  const lastPlayAt = useRef(0);
  const [tone, setTone] = useState<'up' | 'down' | 'none'>('none');

  useEffect(() => {
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
  }, [balance, muted, playSound]);

  useEffect(() => {
    prevBalance.current = balance;
  }, [balance]);

  return tone;
};
