import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Coins, Lock } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useGame } from '../context/GameContext';
import { db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { Poll, UserPollVote, isPollExpired, normalizePoll } from '../src/lib/polls';
import { CoinAmount } from './CoinAmount';

type VoteResponse = {
  ok: boolean;
  pollId: string;
  selectedOptionId: string;
  rewardCoins: number;
  alreadyVoted?: boolean;
};

export const PollsPage: React.FC = () => {
  const { isAuthenticated, user, openAuthModal } = useGame();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votesByPoll, setVotesByPoll] = useState<Record<string, UserPollVote>>({});
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null);
  const [voteNoticeByPoll, setVoteNoticeByPoll] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadPolls = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/polls/list', { method: 'GET' });
        const payload = await response.json().catch(() => null) as { ok?: boolean; polls?: unknown[]; error?: string } | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to load polls.');
        }

        if (cancelled) return;

        const next = (payload.polls ?? [])
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const candidate = entry as Record<string, unknown>;
            const pollId = typeof candidate.id === 'string' ? candidate.id : '';
            return pollId ? normalizePoll(pollId, candidate) : null;
          })
          .filter((poll): poll is Poll => !!poll)
          .filter((poll) => poll.active && poll.published)
          .sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return b.createdAt - a.createdAt;
          });

        setPolls(next);
      } catch (loadError) {
        console.error('Failed to load polls', loadError);
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load polls right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPolls();
    const interval = window.setInterval(() => {
      void loadPolls();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || user.id === 'guest') {
      setVotesByPoll({});
      return;
    }

    const votesRef = collection(db, 'userVotes', user.id, 'polls');
    const unsubscribe = onSnapshot(
      votesRef,
      (snapshot) => {
        const map: Record<string, UserPollVote> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const pollId = typeof data.pollId === 'string' ? data.pollId : docSnap.id;
          const selectedOptionId = typeof data.selectedOptionId === 'string' ? data.selectedOptionId : '';
          if (!pollId || !selectedOptionId) return;
          map[pollId] = {
            pollId,
            selectedOptionId,
            rewardCoins: Math.max(0, Math.floor(Number(data.rewardCoins ?? 0))),
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined
          };
        });
        setVotesByPoll(map);
      },
      (listenError) => {
        console.error('Failed to load vote history', listenError);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, user?.id]);

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (submittingPollId) return;

    setSubmittingPollId(poll.id);
    setError(null);

    try {
      const payload = await authedFetch<VoteResponse>('/api/polls/vote', {
        method: 'POST',
        body: JSON.stringify({ pollId: poll.id, optionId })
      });

      setVotesByPoll((prev) => ({
        ...prev,
        [poll.id]: {
          pollId: poll.id,
          selectedOptionId: payload.selectedOptionId,
          rewardCoins: payload.rewardCoins,
          createdAt: Date.now()
        }
      }));

      setVoteNoticeByPoll((prev) => ({
        ...prev,
        [poll.id]: payload.alreadyVoted
          ? 'You already voted on this poll.'
          : `Vote submitted. You earned ${payload.rewardCoins} coins.`
      }));
    } catch (voteError) {
      console.error('Failed to vote', voteError);
      setError(voteError instanceof Error ? voteError.message : 'Vote failed. Please try again.');
    } finally {
      setSubmittingPollId(null);
    }
  };

  const renderedPolls = useMemo(() => polls.filter((poll) => poll.options.length >= 2), [polls]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0f1727] via-[#121a2d] to-[#111a2f] px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-4 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl sm:h-72 sm:w-72" />
          <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl sm:h-80 sm:w-80" />
        </div>
        <h1 className="relative z-10 mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Polls</h1>
        <p className="relative z-10 mt-2 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
          Vote in active community polls to shape upcoming drops and earn bonus coins.
        </p>
      </section>

      <div className="mt-6 space-y-4 sm:space-y-5">
        {loading && <div className="rounded-2xl border border-white/10 bg-[#131720] p-6 text-sm text-gray-300">Loading polls...</div>}
        {!loading && renderedPolls.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 bg-[#131720] p-6 text-center text-sm text-gray-300">
            No active polls right now. Check back soon.
          </div>
        )}
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>}

        {renderedPolls.map((poll) => {
          const vote = votesByPoll[poll.id];
          const hasVoted = !!vote;
          const expired = isPollExpired(poll);
          const voteLocked = !isAuthenticated || expired || hasVoted || !!submittingPollId;
          const totalVotes = Math.max(0, poll.totalVotes || poll.options.reduce((sum, option) => sum + option.voteCount, 0));

          return (
            <article key={poll.id} className="rounded-2xl border border-white/10 bg-[#131720] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white sm:text-xl">{poll.title}</h2>
                  {poll.description && <p className="mt-1 text-sm text-gray-400">{poll.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  {expired && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">Expired</span>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-300">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
                  <Coins className="h-3.5 w-3.5 text-amber-300" />
                  Vote and earn <CoinAmount amount={poll.rewardCoins} className="font-semibold text-white" iconClassName="h-3.5 w-3.5" />
                </div>
                {poll.endsAt ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-300" /> Ends {new Date(poll.endsAt).toLocaleString()}
                  </div>
                ) : null}
              </div>

              {!hasVoted ? (
                <div className="mt-4 space-y-2.5">
                  {poll.options.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      disabled={voteLocked}
                      onClick={() => handleVote(poll, option.id)}
                      className="w-full rounded-xl border border-white/10 bg-[#0f1522] px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#131b2b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {option.label}
                    </button>
                  ))}
                  {!isAuthenticated && (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      <Lock className="h-3.5 w-3.5" /> Sign in to vote and earn coins.
                    </div>
                  )}
                  {expired && <p className="text-xs text-amber-300">This poll has expired and is no longer accepting votes.</p>}
                </div>
              ) : (
                <div className="mt-4 space-y-2.5 animate-in fade-in duration-300">
                  {poll.options.map((option) => {
                    const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
                    const selected = vote.selectedOptionId === option.id;
                    return (
                      <div key={option.id} className={`rounded-xl border px-3 py-2.5 ${selected ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 bg-[#0f1522]'}`}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className={`font-semibold ${selected ? 'text-cyan-100' : 'text-gray-200'}`}>{option.label}</span>
                          <span className="text-xs text-gray-400">{option.voteCount} votes · {percentage}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-black/30">
                          <div className={`h-2 rounded-full transition-all duration-500 ${selected ? 'bg-cyan-300' : 'bg-white/30'}`} style={{ width: `${Math.max(4, percentage)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                    <span>{totalVotes} participants</span>
                    <span className="text-emerald-300">{voteNoticeByPoll[poll.id] ?? `You earned ${vote.rewardCoins} coins.`}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {!loading && polls.length !== renderedPolls.length && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            Some polls were hidden because they had malformed answer options.
          </div>
        )}
      </div>
    </div>
  );
};
