import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Medal, Trophy } from 'lucide-react';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

interface RewardsSettings {
  enabled: boolean;
  pointsPerCoinSpent: number;
  seasonEndsAt: number | null;
  seasonId: string;
  rewardRules: {
    payoutType: 'coins' | 'xp' | 'item' | 'none';
    payoutsByRank: Array<{ minRank: number; maxRank: number; rewardAmountCoins?: number; rewardAmountXP?: number; rewardItemId?: string }>;
    payoutsByPoints: Array<{ minPoints: number; rewardAmountCoins?: number; rewardAmountXP?: number }>;
  };
}

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatarUrl: string;
  points: number;
}

const DEFAULT_SETTINGS: RewardsSettings = {
  enabled: true,
  pointsPerCoinSpent: 1,
  seasonEndsAt: null,
  seasonId: 'season_open',
  rewardRules: { payoutType: 'none', payoutsByRank: [], payoutsByPoints: [] }
};

const normalizeSettings = (raw: Record<string, any> | undefined): RewardsSettings => {
  const seasonEndsAt = typeof raw?.seasonEndsAt?.toMillis === 'function'
    ? raw.seasonEndsAt.toMillis()
    : (Number.isFinite(Number(raw?.seasonEndsAt)) ? Number(raw?.seasonEndsAt) : null);
  const seasonId = seasonEndsAt ? `season_${new Date(seasonEndsAt).toISOString().slice(0, 10)}` : 'season_open';
  return {
    enabled: raw?.enabled !== false,
    pointsPerCoinSpent: Math.max(0, Number(raw?.pointsPerCoinSpent) || 1),
    seasonEndsAt,
    seasonId,
    rewardRules: {
      payoutType: ['coins', 'xp', 'item', 'none'].includes(raw?.rewardRules?.payoutType) ? raw.rewardRules.payoutType : 'none',
      payoutsByRank: Array.isArray(raw?.rewardRules?.payoutsByRank) ? raw.rewardRules.payoutsByRank : [],
      payoutsByPoints: Array.isArray(raw?.rewardRules?.payoutsByPoints) ? raw.rewardRules.payoutsByPoints : []
    }
  };
};

const computeReward = (settings: RewardsSettings, rank: number | null, points: number) => {
  if (settings.rewardRules.payoutType === 'none') return '—';
  const rankMatch = rank
    ? settings.rewardRules.payoutsByRank.find((rule) => rank >= Number(rule.minRank) && rank <= Number(rule.maxRank))
    : undefined;
  const pointsMatch = settings.rewardRules.payoutsByPoints
    .sort((a, b) => Number(b.minPoints) - Number(a.minPoints))
    .find((rule) => points >= Number(rule.minPoints));
  const source = rankMatch ?? pointsMatch;
  if (!source) return '—';
  if (settings.rewardRules.payoutType === 'coins') return `${Number(source.rewardAmountCoins ?? 0).toLocaleString()} coins`;
  if (settings.rewardRules.payoutType === 'xp') return `${Number(source.rewardAmountXP ?? 0).toLocaleString()} XP`;
  if (settings.rewardRules.payoutType === 'item') return source.rewardItemId ? `Item: ${source.rewardItemId}` : 'Item reward';
  return '—';
};

const getTimeLeft = (seasonEndsAt: number | null) => {
  if (!seasonEndsAt) return null;
  const ms = Math.max(0, seasonEndsAt - Date.now());
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const seconds = Math.floor((ms / 1000) % 60);
  return { days, hours, minutes, seconds };
};

export const Leaderboard: React.FC = () => {
  const { user, setView } = useGame();
  const { playSound } = useSound();
  const [settings, setSettings] = useState<RewardsSettings>(DEFAULT_SETTINGS);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(DEFAULT_SETTINGS.seasonEndsAt));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'rewards'), (snap) => {
      setSettings(normalizeSettings(snap.data() as Record<string, any>));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setTimeLeft(getTimeLeft(settings.seasonEndsAt));
    if (!settings.seasonEndsAt) return;
    const id = window.setInterval(() => setTimeLeft(getTimeLeft(settings.seasonEndsAt)), 1000);
    return () => window.clearInterval(id);
  }, [settings.seasonEndsAt]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const topQuery = query(
        collection(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users'),
        orderBy('points', 'desc'),
        orderBy('updatedAt', 'asc'),
        limit(100)
      );
      const topSnap = await getDocs(topQuery);
      const top = topSnap.docs.map((d) => ({
        uid: d.id,
        displayName: String(d.data().displayName ?? 'Player'),
        avatarUrl: String(d.data().avatarUrl ?? ''),
        points: Number(d.data().points ?? 0)
      }));
      const myDoc = await getDoc(doc(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users', user.id));
      const points = myDoc.exists() ? Number(myDoc.data().points ?? 0) : 0;

      let rank: number | null = null;
      if (points > 0) {
        const higherQuery = query(
          collection(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users'),
          where('points', '>', points)
        );
        const countSnap = await getCountFromServer(higherQuery);
        rank = countSnap.data().count + 1;
      }

      if (mounted) {
        setLeaders(top);
        setMyPoints(points);
        setMyRank(rank);
        setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [settings.seasonId, user.id]);

  const myReward = useMemo(() => computeReward(settings, myRank, myPoints), [settings, myRank, myPoints]);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white">
      <div className="fixed top-0 inset-x-0 z-30 h-16 border-b border-white/10 bg-[#0b0e14]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          <button onClick={() => { playSound('click'); setView({ type: 'HOME' }); }} className="md:hidden text-gray-300"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-base md:text-lg font-semibold tracking-wide mx-auto md:mx-0">Pullz Rewards Leaderboard</h1>
          <div className="w-5 md:w-auto" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-24 pb-10 space-y-6">
        {!settings.enabled ? (
          <div className="rounded-2xl border border-white/10 bg-[#131720] p-6 text-center text-gray-300">Rewards are currently disabled.</div>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-[#131720] p-5 md:p-6">
              <div className="text-xs uppercase text-gray-400 mb-4 tracking-[0.16em]">My Stats</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Rank', value: myRank ? `#${myRank}` : 'Unranked' },
                  { label: 'Points', value: myPoints.toLocaleString() },
                  { label: 'Reward', value: myReward }
                ].map((tile) => (
                  <div key={tile.label} className="rounded-xl border border-white/10 bg-[#0f131b] px-4 py-4">
                    <div className="text-xs text-gray-400 uppercase">{tile.label}</div>
                    <div className="text-xl font-bold mt-1">{tile.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {timeLeft && (
              <section className="rounded-2xl border border-white/10 bg-[#131720] p-5 md:p-6">
                <div className="text-sm text-gray-400 mb-3">Ends in</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['Days', timeLeft.days], ['Hrs', timeLeft.hours], ['Min', timeLeft.minutes], ['Sec', timeLeft.seconds]].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-white/10 bg-[#0f131b] p-3">
                      <div className="text-lg font-bold">{String(value).padStart(2, '0')}</div>
                      <div className="text-[11px] uppercase text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-white/10 bg-[#131720] p-3 md:p-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {leaders.map((entry, idx) => {
                    const rank = idx + 1;
                    const top = rank <= 3;
                    return (
                      <div key={entry.uid} className={`rounded-xl border px-3 py-3 flex items-center gap-3 ${top ? 'border-amber-300/30 bg-amber-400/5' : 'border-white/10 bg-[#0f131b]'}`}>
                        <div className="w-10 text-center font-bold text-gray-300">
                          {rank === 1 ? <Trophy className="w-5 h-5 text-yellow-400 inline" /> : rank === 2 ? <Medal className="w-5 h-5 text-gray-300 inline" /> : rank === 3 ? <Crown className="w-5 h-5 text-orange-400 inline" /> : `#${rank}`}
                        </div>
                        <img src={entry.avatarUrl || 'https://picsum.photos/64'} className="w-9 h-9 rounded-lg" alt={entry.displayName} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{entry.displayName}</div>
                          <div className="text-xs text-gray-400">{entry.points.toLocaleString()} pts</div>
                        </div>
                        <div className="ml-auto text-sm font-bold text-white">#{rank}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};
