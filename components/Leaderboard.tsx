import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Flame, Medal, Sparkles, Star, Timer, Trophy } from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
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

  useEffect(() => {
    const pathLabel = 'settings/rewards';
    console.log('READING FIRESTORE PATH', pathLabel);
    const unsub = onSnapshot(doc(db, 'settings', 'rewards'), (snap) => {
      console.log('SNAPSHOT OK', {
        path: pathLabel,
        size: 'size' in snap ? snap.size : undefined
      });
      setSettings(normalizeSettings(snap.data() as Record<string, any>));
      setSettingsLoaded(true);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: pathLabel,
        code: error?.code,
        message: error?.message,
        error
      });
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
    let mounted = true;
    const run = async () => {
      const hasActiveLeaderboard = settings.enabled && (!settings.seasonEndsAt || Date.now() < settings.seasonEndsAt);
      if (!hasActiveLeaderboard) {
        if (mounted) {
          setLeaders([]);
          setMyPoints(0);
          setMyRank(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const topQuery = query(
        collection(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users'),
        orderBy('points', 'desc'),
        orderBy('updatedAt', 'asc'),
        limit(500)
      );
      const topSnap = await getDocs(topQuery);
      const rankedEntries = topSnap.docs
        .map((d) => ({
          uid: d.id,
          displayName: String(d.data().displayName ?? 'Player'),
          avatarUrl: String(d.data().avatarUrl ?? ''),
          points: Number(d.data().points ?? 0),
          hiddenFromLeaderboard: d.data().hiddenFromLeaderboard === true
        }))
        .filter((entry) => !entry.hiddenFromLeaderboard);
      const top = rankedEntries.slice(0, 100);

      const myDoc = await getDoc(doc(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users', user.id));
      const myData = myDoc.data();
      const isCurrentUserHidden = user.hiddenFromLeaderboard === true || user.hiddenFromPublicDisplay === true || myData?.hiddenFromLeaderboard === true;
      const points = myDoc.exists() && !isCurrentUserHidden ? Number(myData?.points ?? 0) : 0;

      let rank: number | null = null;
      if (points > 0) {
        const currentUserIndex = rankedEntries.findIndex((entry) => entry.uid === user.id);
        rank = currentUserIndex >= 0 ? currentUserIndex + 1 : null;
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
  }, [settings.enabled, settings.seasonEndsAt, settings.seasonId, user.hiddenFromLeaderboard, user.hiddenFromPublicDisplay, user.id]);

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
    <div className="min-h-screen overflow-hidden bg-[#070a12] text-white">
      <main className="relative pb-10 pt-4 sm:pb-14 sm:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[420px] w-[min(760px,92vw)] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -right-28 top-48 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -left-24 bottom-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        </div>
        <div className="mx-auto mb-4 w-full max-w-[1280px] px-3 sm:px-5">
          <button
            onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
            className="relative z-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 shadow-lg shadow-black/10 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <section className="mx-auto mb-6 w-full max-w-[1280px] px-3 sm:mb-8 sm:px-5">
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,24,39,0.92),rgba(10,14,26,0.96))] px-5 py-8 shadow-2xl shadow-black/30 sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-4 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl sm:h-72 sm:w-72" />
              <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl sm:h-80 sm:w-80" />
              <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.05),transparent)]" />
            </div>
            <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
              <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100"><Trophy className="h-3.5 w-3.5" /> Season Arena</p>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Leaderboard</h1>
              <p className="mt-3 text-sm leading-6 text-[#d3dafc] sm:text-base">
                Earn points, climb the podium, and lock in seasonal rewards in a clean competitive hub built for quick mobile checks.
              </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300/15 text-amber-200"><Crown className="h-6 w-6" /></div>
                  <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Top Prize</p><p className="mt-1 text-2xl font-black text-white">Rank #1</p></div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-3 text-sm font-semibold text-slate-200"><Medal className="h-4 w-4 text-violet-200" /> Rewards update with your live rank.</div>
              </div>
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
                <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-3 shadow-xl shadow-black/15 backdrop-blur sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 px-1 text-sm font-bold text-slate-300">
                      <Timer className="h-4 w-4 text-cyan-200" /> Season ends in
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    {[['DAYS', timeLeft.days], ['HRS', timeLeft.hours], ['MIN', timeLeft.minutes], ['SEC', timeLeft.seconds]].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/25 px-2 py-2 text-center sm:min-w-20 sm:px-4 sm:py-3">
                        <div className="text-xl font-black tabular-nums text-white sm:text-2xl">{String(value).padStart(2, '0')}</div>
                        <div className="mt-0.5 text-[10px] font-black tracking-[0.16em] text-slate-400">{label}</div>
                      </div>
                    ))}
                    </div>
                  </div>
                </section>
              )}

            <section>
              <h2 className="mb-3 flex items-center justify-center gap-2 text-center text-2xl font-black tracking-tight sm:text-3xl"><Star className="h-6 w-6 text-amber-200" /> My Stats</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-lg shadow-black/10 backdrop-blur"><div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Rank</div><div className="mt-2 text-2xl font-black">{myRank ? `#${myRank}` : 'Unranked'}</div></div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-lg shadow-black/10 backdrop-blur"><div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Points</div><div className="mt-2 text-2xl font-black text-cyan-100">{myPoints.toLocaleString()} pts</div></div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-lg shadow-black/10 backdrop-blur"><div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reward</div><div className="mt-2 flex items-center gap-2 text-2xl font-black"><img src={COIN_ICON} alt="Coins" className="h-6 w-6 object-contain" loading="lazy" decoding="async" width={24} height={24} /><span>{myReward.label}</span></div></div>
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
                  <article key={entry.uid} className={`relative overflow-hidden rounded-[30px] border bg-gradient-to-b p-5 text-center shadow-xl shadow-black/15 backdrop-blur sm:p-6 ${highlight}`}>
                    <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-400 p-1 text-5xl font-black text-white sm:h-28 sm:w-28 sm:text-6xl">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#111827]">
                        {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" loading="lazy" decoding="async" width={96} height={96} /> : avatarFallback(entry.displayName)}
                      </div>
                    </div>
                    <div className="absolute left-1/2 top-[112px] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/50 px-4 py-2 text-xl font-black text-white backdrop-blur sm:top-[126px]">#{badge}</div>
                    <div className="mt-8 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{entry.displayName}</div>
                    <div className="mx-auto mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-base font-black text-white sm:text-lg"> 
                      <img src={COIN_ICON} alt="Coins" className="h-5 w-5 object-contain" loading="lazy" decoding="async" width={20} height={20} />
                      <span>{rewardByRule(settings, actualRank, entry.points).label}</span>
                    </div>
                    <div className="mt-3 text-xl font-black text-cyan-100 sm:text-2xl">{entry.points.toLocaleString()} pts</div>
                  </article>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-xl shadow-black/15 backdrop-blur">
              <div className="grid grid-cols-[58px_minmax(0,1fr)_auto] gap-2 border-b border-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 sm:grid-cols-[88px_minmax(0,1fr)_160px_160px] sm:px-5">
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
                    const rowRewardLabel = rewardLabelForRank(rank, entry.points);
                    return (
                      <div key={entry.uid} className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 transition hover:border-white/20 hover:bg-white/[0.055] sm:grid-cols-[88px_minmax(0,1fr)_160px_160px] sm:px-4">
                        <div className="text-xl font-black text-slate-200 sm:text-2xl">#{rank}</div>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-300 to-violet-400 text-lg font-black text-white">
                            {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" loading="lazy" decoding="async" width={40} height={40} /> : avatarFallback(entry.displayName)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-black text-white sm:text-lg">{entry.displayName}</div>
                            <div className="mt-0.5 text-xs font-bold text-cyan-100/80 sm:hidden">
                              {entry.points.toLocaleString()} pts
                            </div>
                          </div>
                        </div>
                        <div className="hidden text-lg font-black text-cyan-100 sm:block">{entry.points.toLocaleString()} pts</div>
                        <div className="ml-auto flex items-center justify-end gap-1.5 text-base font-black text-white sm:gap-2 sm:text-lg">
                          <img src={COIN_ICON} alt="Coins" className="h-5 w-5 object-contain" loading="lazy" decoding="async" width={20} height={20} />
                          <span>{rowRewardLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[26px] border border-violet-200/20 bg-gradient-to-r from-violet-400/10 via-cyan-400/10 to-amber-300/10 p-4 shadow-lg shadow-black/10 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xl font-black tracking-tight text-white sm:text-2xl">Bonus Draw: Ranks 11-100</div>
                  <p className="mt-1 text-sm leading-6 text-slate-300 sm:text-base">5 lucky users in ranks 11-100 will randomly be selected to receive <img src={COIN_ICON} alt="Coins" className="inline h-4 w-4 object-contain" loading="lazy" decoding="async" width={16} height={16} /> 100</p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm font-black text-violet-100">
                  <Sparkles className="h-4 w-4" /> Lucky Pool
                </div>
              </div>
            </section>
          </div>
          )}
        </div>
      </main>
    </div>
  );
};
