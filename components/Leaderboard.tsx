import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Flame, Info } from 'lucide-react';
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
  const { user, isAuthenticated, authInitialized, setView } = useGame();
  const { playSound } = useSound();
  const [settings, setSettings] = useState<RewardsSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(DEFAULT_SETTINGS.seasonEndsAt));
  const [showInfo, setShowInfo] = useState(false);

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
      setSettings(DEFAULT_SETTINGS);
      setSettingsLoaded(true);
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
      try {
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

        const canLoadCurrentUser = authInitialized && isAuthenticated && user.id && user.id !== 'guest' && user.id !== 'loading';
        let points = 0;
        let rank: number | null = null;

        if (canLoadCurrentUser) {
          const myDoc = await getDoc(doc(db, 'leaderboards', `rewardsSeason_${settings.seasonId}`, 'users', user.id));
          const myData = myDoc.data();
          const isCurrentUserHidden = user.hiddenFromLeaderboard === true || user.hiddenFromPublicDisplay === true || myData?.hiddenFromLeaderboard === true;
          points = myDoc.exists() && !isCurrentUserHidden ? Number(myData?.points ?? 0) : 0;

          if (points > 0) {
            const currentUserIndex = rankedEntries.findIndex((entry) => entry.uid === user.id);
            rank = currentUserIndex >= 0 ? currentUserIndex + 1 : null;
          }
        }

        if (mounted) {
          setLeaders(top);
          setMyPoints(points);
          setMyRank(rank);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load leaderboard', error);
        if (mounted) {
          setLeaders([]);
          setMyPoints(0);
          setMyRank(null);
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [authInitialized, isAuthenticated, settings.enabled, settings.seasonEndsAt, settings.seasonId, user.hiddenFromLeaderboard, user.hiddenFromPublicDisplay, user.id]);

  const myReward = useMemo(() => {
    if (myRank && myRank >= 4 && myRank <= 10) return { label: '100', coins: 100 };
    if (myRank && myRank <= 3) return rewardByRule(settings, myRank, myPoints);
    return null;
  }, [settings, myRank, myPoints]);
  const hasActiveLeaderboard = settings.enabled && (!settings.seasonEndsAt || Date.now() < settings.seasonEndsAt);

  const topThree = useMemo(() => {
    const picks = leaders.slice(0, 3);
    if (picks.length < 3) return picks;
    return [picks[1], picks[0], picks[2]];
  }, [leaders]);

  const lowerRows = useMemo(() => leaders.slice(3), [leaders]);

  return (
    <div className="min-h-screen bg-[#050811] text-white">
      <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-[#050811] pb-8 sm:max-w-[720px] lg:max-w-[960px]">
        <header className="flex items-center justify-between px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
          <button
            onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#79a7ff] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={2.5} />
          </button>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Leaderboard</h1>
          <button
            type="button"
            onClick={() => { playSound('click'); setShowInfo(true); }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#79a7ff] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="How leaderboard works"
          >
            <Info className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </header>

        {showInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm sm:py-0" role="dialog" aria-modal="true" aria-labelledby="leaderboard-info-title">
            <div className="max-h-[calc(100dvh-3rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#101827] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#050811] text-[#79a7ff]">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="leaderboard-info-title" className="text-base font-black text-white">How leaderboard works</h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Every coin spent earns 1 leaderboard point. Keep playing to climb the rankings before the season ends.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { playSound('click'); setShowInfo(false); }}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(32,93,215,0.35)] transition hover:brightness-110"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {settingsLoaded && !hasActiveLeaderboard ? (
          <section className="mx-5 mt-10 rounded-[28px] bg-[#101827]/72 px-5 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:mx-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#050811] text-[#79a7ff]"><Flame className="h-8 w-8" /></div>
            <h2 className="mt-5 text-2xl font-black text-white">Starting Soon</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/65">There isn’t a leaderboard running right now. Check back soon for the next competition and rewards drop.</p>
          </section>
        ) : (
          <div className="mt-5">
            {timeLeft && (
              <section className="mx-5 mb-5 rounded-2xl bg-[#101827]/72 p-3 sm:mx-8">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['DAYS', timeLeft.days], ['HRS', timeLeft.hours], ['MIN', timeLeft.minutes], ['SEC', timeLeft.seconds]].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-[#050811]/70 px-2 py-2">
                      <div className="text-base font-black text-[#79a7ff] sm:text-xl">{String(value).padStart(2, '0')}</div>
                      <div className="text-[9px] font-bold tracking-wider text-white/45 sm:text-[10px]">{label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="px-5 sm:px-8">
              <div className="grid min-h-[262px] grid-cols-3 items-end gap-0 sm:min-h-[310px] sm:gap-3">
                {(loading ? Array.from({ length: 3 }) : topThree).map((entry, idx) => {
                  if (!entry) return <div key={`loading-${idx}`} className="mx-auto mb-1 h-36 w-full max-w-[116px] animate-pulse rounded-[22px] bg-[#101827]/72 sm:max-w-[150px]" />;
                  const actualRank = leaders.findIndex((leader) => leader.uid === entry.uid) + 1;
                  const isFirst = actualRank === 1;
                  const isSecond = actualRank === 2;
                  const frame = isFirst ? 'from-[#ffb600] to-[#16d67b]' : isSecond ? 'from-[#00b8ff] to-[#0274ff]' : 'from-[#12e66f] to-[#00b8ff]';
                  const cardHeight = isFirst ? 'h-[184px] sm:h-[212px]' : 'h-[158px] sm:h-[186px]';
                  const avatarSize = isFirst ? 'h-[74px] w-[74px] sm:h-24 sm:w-24' : 'h-[62px] w-[62px] sm:h-20 sm:w-20';
                  const rankColor = isFirst ? 'bg-[#ffb600]' : isSecond ? 'bg-[#00b8ff]' : 'bg-[#10dc72]';
                  const pointColor = isFirst ? 'text-[#ffc019]' : isSecond ? 'text-[#00b8ff]' : 'text-[#13df72]';
                  const rewardLabel = rewardByRule(settings, actualRank, entry.points).label;
                  return (
                    <article key={entry.uid} className={`relative flex ${cardHeight} flex-col items-center rounded-t-[26px] border border-white/[0.06] bg-[#101827]/72 px-2 pb-4 pt-10 text-center shadow-[0_16px_35px_rgba(5,8,12,0.22)] sm:px-4 sm:pt-12`}>
                      {isFirst && <Crown className="absolute -top-[84px] h-12 w-12 rotate-[-10deg] fill-[#ffb600] text-[#ffb600] sm:-top-[98px] sm:h-14 sm:w-14" />}
                      <div className={`absolute left-1/2 top-0 flex ${avatarSize} -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br ${frame} p-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.25)]`}>
                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#050811] text-2xl font-black text-white">
                          {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : avatarFallback(entry.displayName)}
                        </div>
                      </div>
                      <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${rankColor} text-[11px] font-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.25)]`}>{actualRank}</div>
                      <div className="mt-2 w-full truncate text-xs font-semibold text-white sm:text-base">{entry.displayName}</div>
                      <div className={`mt-1 text-base font-black ${pointColor} sm:text-xl`}>{entry.points.toLocaleString()}</div>
                      <div className="mt-1 flex w-full items-center justify-center gap-1 truncate text-[10px] font-semibold text-white/55 sm:text-xs"><span>Reward</span><img src={COIN_ICON} alt="Coins" className="h-3 w-3 object-contain sm:h-3.5 sm:w-3.5" loading="lazy" decoding="async" /><span className="truncate">{rewardLabel}</span></div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-7 rounded-t-[34px] border border-white/[0.06] bg-[#101827]/72 px-5 pb-8 pt-5 shadow-[0_14px_36px_rgba(5,8,12,0.18)] sm:mx-8 sm:rounded-[34px] sm:px-8">
              {loading ? (
                <div className="space-y-4">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-white/5" />)}</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {lowerRows.slice(0, 20).map((entry, index) => {
                    const rank = index + 4;
                    const rowRewardLabel = rank >= 4 && rank <= 10 ? '100' : null;
                    return (
                      <div key={entry.uid} className="grid grid-cols-[2rem_3.5rem_1fr_auto] items-center gap-2 py-4 sm:grid-cols-[2.5rem_4rem_1fr_auto] sm:gap-3">
                        <div className="text-sm font-black text-white/70 sm:text-base">#{rank}</div>
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#273250] to-[#1b2024] text-lg font-black text-white sm:h-14 sm:w-14">
                          {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : avatarFallback(entry.displayName)}
                        </div>
                        <div className="min-w-0"><div className="truncate text-sm font-semibold text-white sm:text-base">{entry.displayName}</div>{rowRewardLabel && <div className="mt-1 flex min-w-0 items-center gap-1 text-[10px] font-semibold text-white/50 sm:text-xs"><span>Reward</span><img src={COIN_ICON} alt="Coins" className="h-3 w-3 shrink-0 object-contain sm:h-3.5 sm:w-3.5" loading="lazy" decoding="async" /><span className="truncate">{rowRewardLabel}</span></div>}</div>
                        <div className="text-right text-sm font-black text-white sm:text-base">{entry.points.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mx-5 mt-5 rounded-2xl border border-white/[0.06] bg-[#101827]/72 p-4 text-sm text-white/70 sm:mx-8">
              <div><div className="font-bold text-white">Your rank: {myRank ? `#${myRank}` : 'Unranked'}</div><div className="mt-1 flex flex-wrap items-center gap-1"><span>{myPoints.toLocaleString()} points</span>{myReward && <><span>· Reward</span><img src={COIN_ICON} alt="Coins" className="h-3.5 w-3.5 object-contain" loading="lazy" decoding="async" /><span>{myReward.label}</span></>}</div></div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
