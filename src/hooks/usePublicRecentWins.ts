import { useCallback, useEffect, useState } from 'react';
import { CaseItem } from '../../types';

export type PublicRecentWin = {
  id: string;
  itemName: string;
  itemImage: string;
  itemValue: number;
  rarity: CaseItem['rarity'];
  boxId: string;
  boxName: string;
  createdAt: number | null;
  displayName: string;
};

type PublicRecentWinsState = {
  wins: PublicRecentWin[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
};

const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);

const mapPublicWin = (rawWin: unknown): PublicRecentWin | null => {
  if (!rawWin || typeof rawWin !== 'object') return null;
  const win = rawWin as Record<string, unknown>;
  const rarity = typeof win.rarity === 'string' && VALID_RARITIES.has(win.rarity)
    ? win.rarity as CaseItem['rarity']
    : 'common';

  return {
    id: String(win.id || ''),
    itemName: String(win.itemName || 'Mystery Item'),
    itemImage: typeof win.itemImage === 'string' ? win.itemImage : '',
    itemValue: Number(win.itemValue ?? 0),
    rarity,
    boxId: String(win.boxId || ''),
    boxName: String(win.boxName || 'Mystery Box'),
    createdAt: win.createdAt === null ? null : Number(win.createdAt ?? 0),
    displayName: String(win.displayName || 'Player')
  };
};

export const usePublicRecentWins = (limit = 16): PublicRecentWinsState => {
  const [wins, setWins] = useState<PublicRecentWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/recent-wins?limit=${encodeURIComponent(String(limit))}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Recent wins request failed (${response.status})`);
        return response.json() as Promise<{ wins?: unknown[] }>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const mappedWins = Array.isArray(payload.wins)
          ? payload.wins.map(mapPublicWin).filter((win): win is PublicRecentWin => Boolean(win?.id && win.boxId))
          : [];
        setWins(mappedWins);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setWins([]);
        setError(fetchError instanceof Error ? fetchError : new Error('Unable to load recent wins.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [limit, refreshKey]);

  const retry = useCallback(() => setRefreshKey((value) => value + 1), []);

  return { wins, loading, error, retry };
};
