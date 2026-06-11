import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Flame } from 'lucide-react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { COIN_ICON } from '../constants';

interface RewardsSettings {
  enabled: boolean;
  pointsPerCoinSpent: number;
  seasonEndsAt: number | null;
  seasonId: string;
  heroImageUrl: string;
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
  hiddenFromLeaderboard?: boolean;
  updatedAt: number;
}

const DEFAULT_SETTINGS: RewardsSettings = {
  enabled: true,
  pointsPerCoinSpent: 1,
  seasonEndsAt: null,
  seasonId: 'season_open',
  heroImageUrl: '',
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
    heroImageUrl: typeof raw?.heroImageUrl === 'string' ? raw.heroImageUrl.trim() : '',
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

const timestampToMillis = (value: any) => {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const Leaderboard: React.FC = () => {
  const { user, setView } = useGame();
  const { playSound } = useSound();
  const [settings, setSettings] = useState<RewardsSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(DEFAULT_SETTINGS.seasonEndsAt));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const pathLabel = 'settings/rewards';
    const unsub = onSnapshot(doc(db, 'settings', 'rewards'), (snap) => {
      setSettings(normalizeSettings(snap.data() as Record<string, any> | undefined));
      setSettingsLoaded(true);
      setLoadError(null);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: pathLabel,
        code: error?.code,
        message: error?.message,
        error
      });
      setSettings(DEFAULT_SETTINGS);
      setSettingsLoaded(true);
      setLoadError('Leaderboard settings could not be loaded. Showing the default leaderboard view.');
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
    if (!settings.seasonEndsAt || Date.now() < settings.seasonEndsAt) return;
    let cancelled = false;
    const settle = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch('/api/rewards/settle-season', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to settle rewards season from client trigger', error);
        }
      }
    };
    void settle();
    return () => {
      cancelled = true;
    };
  }, [settings.seasonEndsAt]);

  useEffect(() => {
    if (!settingsLoaded) return undefined;

    const hasActiveLeaderboard = settings.enabled && (!settings.seasonEndsAt || Date.now() < settings.seasonEndsAt);
    if (!hasActiveLeaderboard) {
      setLeaders([]);
      setMyPoints(0);
      setMyRank(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const leaderboardPath = `leaderboards/rewardsSeason_${settings.seasonId}/users?limit=500`;
    const topQuery = query(
      collection(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users'),
      orderBy('points', 'desc'),
      limit(500)
    );

    const unsub = onSnapshot(topQuery, (topSnap) => {
      const rankedEntries = topSnap.docs
        .map((d) => ({
          uid: d.id,
          displayName: String(d.data().displayName ?? 'Player'),
          avatarUrl: String(d.data().avatarUrl ?? ''),
          points: Number(d.data().points ?? 0),
          hiddenFromLeaderboard: d.data().hiddenFromLeaderboard === true,
          updatedAt: timestampToMillis(d.data().updatedAt)
        }))
        .filter((entry) => !entry.hiddenFromLeaderboard)
        .sort((a, b) => (b.points - a.points) || (a.updatedAt - b.updatedAt));
      const top = rankedEntries.slice(0, 100);
      const currentUserEntry = user.id !== 'loading' && user.id !== 'guest'
        ? rankedEntries.find((entry) => entry.uid === user.id)
        : undefined;
      const isCurrentUserHidden = user.hiddenFromLeaderboard === true || user.hiddenFromPublicDisplay === true;
      const nextMyPoints = currentUserEntry && !isCurrentUserHidden ? currentUserEntry.points : 0;
      const nextMyRank = currentUserEntry && !isCurrentUserHidden ? rankedEntries.findIndex((entry) => entry.uid === user.id) + 1 : null;

      setLeaders(top);
      setMyPoints(nextMyPoints);
      setMyRank(nextMyRank && nextMyRank > 0 ? nextMyRank : null);
      setLoading(false);
      setLoadError(null);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: leaderboardPath,
        code: error?.code,
        message: error?.message,
        error
      });
      setLeaders([]);
      setMyPoints(0);
      setMyRank(null);
      setLoading(false);
      setLoadError('Leaderboard data could not be loaded. Please try again in a moment.');
    });

    return () => unsub();
  }, [settings.enabled, settings.seasonEndsAt, settings.seasonId, settingsLoaded, user.hiddenFromLeaderboard, user.hiddenFromPublicDisplay, user.id]);

  const myReward = useMemo(() => rewardByRule(settings, myRank, myPoints), [settings, myRank, myPoints]);
  const hasActiveLeaderboard = settings.enabled && (!settings.seasonEndsAt || Date.now() < settings.seasonEndsAt);

  const topThree = useMemo(() => {
    const picks = leaders.slice(0, 3);
    if (picks.length < 3) return picks;
    return [picks[1], picks[0], picks[2]];
  }, [leaders]);

  const lowerRows = useMemo(() => leaders.slice(3), [leaders]);

  const rewardLabelForRank = (rank: number, points: number) => {
    if (rank >= 4 && rank <= 10) return '100';
    return rewardByRule(settings, rank, points).label;
  };

  return (
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="pb-10 pt-6 sm:pt-8">
        <div className="mx-auto mb-4 w-full max-w-[1280px] px-3 sm:px-5">
          <button
            onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
            className="inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <section className="mx-auto mb-6 w-full max-w-[1280px] px-3 sm:mb-8 sm:px-5">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#161b1f] px-5 py-8 sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-4 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl sm:h-72 sm:w-72" />
              <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl sm:h-80 sm:w-80" />
            </div>
            <div className="relative z-10 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Rewards Competition</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Leaderboard</h1>
              <p className="mt-3 text-sm leading-6 text-[#d3dafc] sm:text-base">
                Climb the rankings each season by earning points and lock in bigger rewards before the timer runs out.
              </p>
            </div>
          </div>
        </section>
        <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-5">
          {settingsLoaded && !hasActiveLeaderboard ? (
            <section className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,23,37,0.96)_0%,rgba(13,17,27,0.96)_100%)] px-5 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8 sm:py-14">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#7f74ff]/35 bg-[#7f74ff]/12 text-[#b9b2ff] sm:h-20 sm:w-20">
                <Flame className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <h2 className="mt-5 text-3xl font-black uppercase tracking-[0.16em] text-white sm:text-4xl">
                Starting Soon
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#cdd3f5] sm:text-base">
                There isn’t a leaderboard running right now. Check back soon for the next competition and rewards drop.
              </p>
            </section>
          ) : (
            <div className="space-y-8">
              {timeLeft && (
                <section className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#161b1f] p-4 sm:p-5">
                  <div className="flex items-center justify-center gap-3 sm:gap-5">
                    <div className="hidden items-center gap-2 text-sm font-semibold text-gray-400 sm:flex">
                      <Flame className="h-4 w-4 text-[#8f7dff]" /> Ends in:
                    </div>
                    {[['DAYS', timeLeft.days], ['HRS', timeLeft.hours], ['MIN', timeLeft.minutes], ['SEC', timeLeft.seconds]].map(([label, value]) => (
                      <div key={String(label)} className="w-16 rounded-xl border border-[#7f74ff]/40 bg-gradient-to-b from-[#7f74ff]/25 to-[#1a2132] px-2 py-2 text-center shadow-[inset_0_2px_12px_rgba(162,154,255,0.3)] sm:w-20 sm:py-3">
                        <div className="text-lg font-black text-[#b9b2ff] sm:text-2xl">{String(value).padStart(2, '0')}</div>
                        <div className="text-[10px] font-bold tracking-wider text-gray-300 sm:text-xs">{label}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {loadError && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 sm:px-5" role="status">
                  {loadError}
                </div>
              )}

              <section>
                <h2 className="mb-4 text-center text-2xl font-bold sm:text-3xl">My Stats</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="rounded-xl bg-[#15171d] px-4 py-4 text-lg font-semibold">Rank: <span className="font-black">{myRank ? `#${myRank}` : 'Unranked'}</span></div>
                  <div className="rounded-xl bg-[#15171d] px-4 py-4 text-lg font-semibold">Points: <span className="font-black text-[#8f7dff]">{myPoints.toLocaleString()} pts</span></div>
                  <div className="rounded-xl bg-[#15171d] px-4 py-4 text-lg font-semibold flex items-center gap-2">Reward: <img src={COIN_ICON} alt="Coins" className="h-4 w-4 object-contain" loading="lazy" decoding="async" width={16} height={16} /><span className="font-black">{myReward.label}</span></div>
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
                  ? 'from-[#6b60ff]/35 via-[#6b60ff]/12 to-transparent border-[#6b60ff]/45'
                  : actualRank === 2
                    ? 'from-[#58d5b3]/20 via-[#58d5b3]/10 to-transparent border-[#58d5b3]/40'
                    : 'from-[#ec68c8]/24 via-[#ec68c8]/10 to-transparent border-[#ec68c8]/38';

                return (
                  <article key={entry.uid} className={`relative overflow-hidden rounded-[26px] border bg-gradient-to-b p-5 text-center sm:p-6 ${highlight}`}>
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#205DD7] to-sky-400 text-6xl font-black text-white">
                      {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full rounded-full object-cover" loading="lazy" decoding="async" width={48} height={48} /> : avatarFallback(entry.displayName)}
                    </div>
                    <div className="absolute left-1/2 top-[126px] -translate-x-1/2 rounded-xl bg-[#5a55ff] px-4 py-2 text-xl font-black text-white">#{badge}</div>
                    <div className="mt-8 truncate text-3xl font-bold text-white sm:text-4xl">{entry.displayName}</div>
                    <div className="mt-2 flex items-center justify-center gap-2 text-lg font-black text-[#a89fff] sm:text-xl"> 
                      <img src={COIN_ICON} alt="Coins" className="h-5 w-5 object-contain" loading="lazy" decoding="async" width={20} height={20} />
                      <span>{rewardByRule(settings, actualRank, entry.points).label}</span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-[#58d5b3] sm:text-3xl">{entry.points.toLocaleString()} pts</div>
                  </article>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#161b1f]">
              <div className="grid grid-cols-[48px_minmax(0,1fr)_86px] gap-2 border-b border-white/10 px-3 py-3 text-xs font-bold text-gray-400 sm:grid-cols-[100px_1fr_220px_220px] sm:px-6 sm:text-[28px]">
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
                  {lowerRows.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm font-semibold text-gray-300 sm:text-base">
                      No ranked players yet. Open cases to start climbing the leaderboard.
                    </div>
                  )}
                  {lowerRows.map((entry, index) => {
                    const rank = index + 4;
                    const rowRewardLabel = rewardLabelForRank(rank, entry.points);
                    return (
                      <div key={entry.uid} className="grid grid-cols-[48px_minmax(0,1fr)_86px] items-center gap-2 rounded-2xl border border-white/10 bg-[#1b2228] px-3 py-4 sm:grid-cols-[100px_1fr_220px_220px] sm:px-6">
                        <div className="text-xl font-black text-white sm:text-2xl">{rank}</div>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#205DD7] to-sky-400 text-lg font-black text-white">
                            {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full rounded-full object-cover" loading="lazy" decoding="async" width={48} height={48} /> : avatarFallback(entry.displayName)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-lg font-extrabold text-white sm:text-2xl">{entry.displayName}</div>
                            <div className="mt-0.5 text-sm font-bold text-[#8f7dff]">
                              {entry.points.toLocaleString()} pts
                            </div>
                          </div>
                        </div>
                        <div className="hidden text-2xl font-black text-[#8f7dff] sm:block">{entry.points.toLocaleString()} <span className="text-[#8f7dff]">pts</span></div>
                        <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 text-base font-black sm:gap-2 sm:text-2xl">
                          <img src={COIN_ICON} alt="Coins" className="h-5 w-5 object-contain" loading="lazy" decoding="async" width={20} height={20} />
                          <span>{rowRewardLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#6b60ff]/30 bg-gradient-to-r from-[#151a31] via-[#121829] to-[#0d111b] p-4 sm:p-6">
              <div className="text-2xl font-black">Rank 11-100</div>
              <p className="mt-1 text-base text-[#d9ddf0] sm:text-lg">5 lucky users in ranks 11-100 will randomly be selected to receive <img src={COIN_ICON} alt="Coins" className="inline h-4 w-4 object-contain" loading="lazy" decoding="async" width={16} height={16} /> 100</p>
            </section>
          </div>
          )}
        </div>
      </main>
    </div>
  );
};
