import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../utils/authedFetch';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const useBattleProgressDriver = (battleId: string, battle: any) => {
  const [driverWarning, setDriverWarning] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!battleId || !battle?.state) return;
    let mounted = true;

    const callApi = async (path: '/api/battles/tick' | '/api/battles/progress') => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await authedFetch(path, { method: 'POST', body: JSON.stringify({ battleId }) });
        if (mounted) setDriverWarning(null);
      } catch {
        if (mounted) setDriverWarning('Sync degraded: retrying battle updates…');
      } finally {
        inFlightRef.current = false;
      }
    };

    if (battle.state === 'LOBBY' || battle.state === 'COUNTDOWN') {
      void callApi('/api/battles/tick');
      const i = window.setInterval(() => void callApi('/api/battles/tick'), 2000);
      return () => {
        mounted = false;
        window.clearInterval(i);
      };
    }

    if (battle.state === 'RUNNING') {
      const cadence = clamp(Number(battle.roundDurationMs ?? 3600) - 250, 1500, 3000);
      void callApi('/api/battles/progress');
      const i = window.setInterval(() => void callApi('/api/battles/progress'), cadence);
      return () => {
        mounted = false;
        window.clearInterval(i);
      };
    }

    return () => {
      mounted = false;
    };
  }, [battleId, battle?.state, battle?.roundDurationMs]);

  return { driverWarning };
};
