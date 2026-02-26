import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Flame, Gem, Menu } from 'lucide-react';
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

const rewardByRule = (settings: RewardsSettings, rank: number | null, points: number) => {
  if (settings.rewardRules.payoutType === 'none') return { label: '0', coins: 0 };

  const rankMatch = rank
    ? settings.rewardRules.payoutsByRank.find((rule) => rank >= Number(rule.minRank) && rank <= Number(rule.maxRank))
    : undefined;

  const pointsMatch = [...settings.rewardRules.payoutsByPoints]
    .sort((a, b) => Number(b.minPoints) - Number(a.minPoints))
    .find((rule) => points >= Number(rule.minPoints));

  const source = rankMatch ?? pointsMatch;
  if (!source) return { label: '0', coins: 0 };

  if (settings.rewardRules.payoutType === 'coins') {
    const amount = Number(source.rewardAmountCoins ?? 0);
    return { label: amount.toLocaleString(), coins: amount };
  }

  if (settings.rewardRules.payoutType === 'xp') {
    return { label: `${Number(source.rewardAmountXP ?? 0).toLocaleString()} XP`, coins: 0 };
  }

  if (settings.rewardRules.payoutType === 'item') {
    return { label: source.rewardItemId ? String(source.rewardItemId) : 'Item', coins: 0 };
  }

  return { label: '0', coins: 0 };
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

const avatarFallback = (name: string) => name.trim().charAt(0).toUpperCase() || 'P';

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

  const myReward = useMemo(() => rewardByRule(settings, myRank, myPoints), [settings, myRank, myPoints]);

  const topThree = useMemo(() => {
    const picks = leaders.slice(0, 3);
    if (picks.length < 3) return picks;
    return [picks[1], picks[0], picks[2]];
  }, [leaders]);

  const lowerRows = useMemo(() => leaders.slice(3), [leaders]);

  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center gap-2 px-3 sm:px-5">
          <button
            onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
            className="rounded-lg p-2 text-gray-300 hover:bg-white/5 md:hidden"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="text-3xl font-black tracking-tight italic lowercase">pullz</div>

          <div className="ml-2 hidden items-center gap-2 md:flex">
            <button className="rounded-2xl border border-white/10 bg-[#121722] px-6 py-3 text-lg font-semibold text-gray-300">Games</button>
            <button className="rounded-2xl border border-white/10 bg-[#121722] px-6 py-3 text-lg font-semibold text-gray-300">Rewards</button>
            <button className="rounded-2xl border border-white/10 bg-[#171b24] px-6 py-3 text-lg font-semibold text-white">Leaderboard</button>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center rounded-2xl border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-sm font-bold text-orange-300 sm:flex">
              <Flame className="mr-2 h-4 w-4" />0
            </div>
            <div className="flex items-center rounded-2xl border border-white/15 bg-[#151922] px-3 py-2 text-sm font-bold">
              <Gem className="mr-1.5 h-4 w-4 text-orange-400" />
              {Number(user.balance ?? 0).toLocaleString()}
            </div>
            <button className="rounded-2xl bg-[#ff5b00] px-4 py-2 text-sm font-extrabold text-white sm:px-6">Refill</button>
            <button className="rounded-2xl border border-white/10 bg-[#151922] p-2.5 text-gray-200"><Menu className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-3 pb-10 pt-24 sm:px-5 sm:pt-28">
        {!settings.enabled ? (
          <div className="rounded-2xl border border-white/10 bg-[#101217] p-6 text-center text-gray-300">Rewards are currently disabled.</div>
        ) : (
          <div className="space-y-8">
            {timeLeft && (
              <section className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f1117] p-4 sm:p-5">
                <div className="flex items-center justify-center gap-3 sm:gap-5">
                  <div className="hidden items-center gap-2 text-sm font-semibold text-gray-400 sm:flex">
                    <Flame className="h-4 w-4 text-orange-500" /> Ends in:
                  </div>
                  {[['DAYS', timeLeft.days], ['HRS', timeLeft.hours], ['MIN', timeLeft.minutes], ['SEC', timeLeft.seconds]].map(([label, value]) => (
                    <div key={String(label)} className="w-16 rounded-xl bg-gradient-to-b from-white/20 to-white/5 px-2 py-2 text-center shadow-[inset_0_2px_12px_rgba(255,255,255,0.2)] sm:w-20 sm:py-3">
                      <div className="text-lg font-black text-[#ff5b00] sm:text-2xl">{String(value).padStart(2, '0')}</div>
                      <div className="text-[10px] font-bold tracking-wider text-gray-300 sm:text-xs">{label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-4 text-center text-3xl font-bold">My Stats</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="rounded-xl bg-[#15171d] px-4 py-4 text-lg font-semibold">Rank: <span className="font-black">{myRank ? `#${myRank}` : 'Unranked'}</span></div>
                <div className="rounded-xl bg-[#15171d] px-4 py-4 text-lg font-semibold">Points: <span className="font-black text-[#ff5b00]">{myPoints.toLocaleString()} pts</span></div>
                <div className="rounded-xl bg-[#15171d] px-4 py-4 text-lg font-semibold flex items-center gap-2">Reward: <Gem className="h-4 w-4 text-orange-400" /><span className="font-black">{myReward.label}</span></div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {(loading ? Array.from({ length: 3 }) : topThree).map((entry, idx) => {
                if (!entry) {
                  return <div key={`loading-${idx}`} className="h-[280px] rounded-[26px] border border-white/10 bg-white/5 animate-pulse" />;
                }

                const actualRank = leaders.findIndex((leader) => leader.uid === entry.uid) + 1;
                const badge = actualRank === 1 ? '1' : actualRank === 2 ? '2' : '3';
                const highlight = actualRank === 1
                  ? 'from-yellow-500/30 via-yellow-500/10 to-transparent border-yellow-500/40'
                  : actualRank === 2
                    ? 'from-gray-300/25 via-gray-300/10 to-transparent border-gray-300/35'
                    : 'from-orange-500/25 via-orange-500/10 to-transparent border-orange-500/35';

                return (
                  <article key={entry.uid} className={`relative overflow-hidden rounded-[26px] border bg-gradient-to-b p-6 text-center ${highlight}`}>
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-lime-400 text-6xl font-black text-white">
                      {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full rounded-full object-cover" /> : avatarFallback(entry.displayName)}
                    </div>
                    <div className="absolute left-1/2 top-[126px] -translate-x-1/2 rounded-xl bg-[#ff8a00] px-4 py-2 text-xl font-black text-black">#{badge}</div>
                    <div className="mt-8 text-4xl font-bold text-white truncate">{entry.displayName}</div>
                    <div className="mt-2 text-3xl font-black text-[#ffb347]">{entry.points.toLocaleString()} pts</div>
                  </article>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f14]">
              <div className="grid grid-cols-[80px_1fr_120px] gap-2 border-b border-white/10 px-4 py-3 text-sm font-bold text-gray-400 sm:grid-cols-[100px_1fr_220px_220px] sm:px-6 sm:text-[28px]">
                <div>Rank</div>
                <div>Player</div>
                <div className="hidden sm:block">Points</div>
                <div className="text-right">Reward</div>
              </div>

              {loading ? (
                <div className="space-y-2 p-3 sm:p-4">
                  {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-[72px] rounded-2xl bg-white/5 animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2 p-3 sm:p-4">
                  {lowerRows.map((entry, index) => {
                    const rank = index + 4;
                    const rowReward = rewardByRule(settings, rank, entry.points);
                    return (
                      <div key={entry.uid} className="grid grid-cols-[80px_1fr_120px] items-center gap-2 rounded-2xl border border-white/10 bg-[#121419] px-4 py-4 sm:grid-cols-[100px_1fr_220px_220px] sm:px-6">
                        <div className="text-2xl font-black text-white">{rank}</div>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-lime-400 text-lg font-black text-white">
                            {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full rounded-full object-cover" /> : avatarFallback(entry.displayName)}
                          </div>
                          <div className="truncate text-2xl font-extrabold text-white">{entry.displayName}</div>
                        </div>
                        <div className="hidden text-2xl font-black text-[#ff5b00] sm:block">{entry.points.toLocaleString()} <span className="text-[#ff5b00]">pts</span></div>
                        <div className="ml-auto flex items-center justify-end gap-2 text-2xl font-black">
                          <Gem className="h-5 w-5 text-orange-400" />
                          <span>{rowReward.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-orange-500/25 bg-gradient-to-r from-[#2d1205] via-[#1a0f08] to-[#0d0f14] p-4 sm:p-6">
              <div className="text-2xl font-black">Rank 11-100</div>
              <p className="mt-1 text-base text-orange-100/90 sm:text-lg">5 lucky users in ranks 11-100 will randomly be selected to receive <Gem className="inline h-4 w-4 text-orange-300" /> 100</p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
