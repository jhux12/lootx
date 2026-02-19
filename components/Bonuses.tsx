import React from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { DailySpinPage } from './DailySpinPage';
import { authedFetch } from '../utils/authedFetch';

export const Bonuses: React.FC = () => {
  const { user, setView, isAuthenticated, openAuthModal } = useGame();
  const { playSound } = useSound();

  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN) ? Number(user.lastDailyClaim) : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const nextDailyClaimAt = lastDailyClaim + dailyCooldownMs;
  const canClaim = !lastDailyClaim || nextDailyClaimAt <= Date.now();

  const handleSpinStart = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      throw new Error('Please login to spin.');
    }

    if (!canClaim) {
      playSound('error');
      throw new Error('Daily spin is on cooldown.');
    }

    const data = await authedFetch<{ prizeAmount: number }>('/api/daily-spin', {
      method: 'POST',
      body: JSON.stringify({ action: 'spin' })
    });

    return {
      amount: Number(data.prizeAmount ?? 0)
    };
  };

  const handleSpinClaim = async () => {
    const data = await authedFetch<{ prizeAmount: number; nextClaimAt: number }>('/api/daily-spin', {
      method: 'POST',
      body: JSON.stringify({ action: 'claim' })
    });

    playSound('coins');

    return {
      amount: Number(data.prizeAmount ?? 0),
      nextClaimAt: Number(data.nextClaimAt ?? Date.now() + dailyCooldownMs)
    };
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <DailySpinPage
        onBack={() => setView({ type: 'HOME' })}
        onSpinStart={handleSpinStart}
        onSpinClaim={handleSpinClaim}
        canSpin={canClaim}
        nextClaimAt={nextDailyClaimAt}
      />
    </div>
  );
};
