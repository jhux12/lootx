import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Gift, Target } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { authedFetch } from '../utils/authedFetch';
import { getQuestClaimToken, getQuestProgressValue, isQuestCycleExpired, normalizeQuestRules, QuestProgressStats, QuestRule } from '../src/lib/quests';


export const Quests: React.FC = () => {
  const { user, isAuthenticated, openAuthModal, syncBalance } = useGame();
  const [rules, setRules] = useState<QuestRule[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'bonus-settings'), (snap) => {
      const data = snap.data() as Record<string, unknown> | undefined;
      setRules(normalizeQuestRules(data?.questRules));
    });
    return () => unsub();
  }, []);

  const stats = (user as any).challengeStats as QuestProgressStats | undefined;
  const claims = ((user as any).questClaims ?? {}) as Record<string, string>;
  const cycleMeta = {
    lastDailyClaim: Number((user as any).lastDailyClaim ?? 0),
    questCycleStartedAt: Number((user as any).questCycleStartedAt ?? 0)
  };
  const cycleExpired = isQuestCycleExpired(cycleMeta);
  const claimToken = getQuestClaimToken(cycleMeta);

  const rows = useMemo(() => rules.filter((rule) => rule.enabled !== false).map((rule) => {
    const value = cycleExpired ? 0 : getQuestProgressValue(rule, stats ?? {});
    const target = Math.max(1, rule.target);
    const completed = value >= target;
    const alreadyClaimed = !cycleExpired && claims?.[rule.id] === claimToken;
    return { rule, value, target, completed, alreadyClaimed };
  }), [claims, rules, stats]);

  const claim = async (questId: string) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setClaimingId(questId);
    try {
      const result = await authedFetch<{ newCoins?: number; rewardCoins?: number }>('/api/rewards/claim-quest', {
        method: 'POST',
        body: JSON.stringify({ questId })
      });
      if (typeof result?.newCoins === 'number') {
        syncBalance(result.newCoins);
      }
    } catch (error) {
      console.error('Failed to claim quest reward', error);
      alert('Could not claim quest reward right now.');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mb-5 rounded-2xl border border-white/10 bg-[#0f1117] p-4 sm:p-6">
        <h1 className="text-xl font-extrabold text-white sm:text-2xl">Mini Challenges / Quests</h1>
        <p className="mt-2 text-sm text-gray-300">Complete 3 actions today for bonus rewards. Missions reset daily.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {rows.map(({ rule, value, target, completed, alreadyClaimed }) => {
          const progress = Math.min(100, Math.round((value / target) * 100));
          return (
            <article key={rule.id} className="rounded-2xl border border-white/10 bg-[#10131b] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-cyan-200 sm:text-base">{rule.title}</p>
                  <p className="mt-1 text-xs text-gray-400 sm:text-sm">{rule.description || 'Complete this mission to claim your reward.'}</p>
                </div>
                <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">
                  <Gift className="h-3.5 w-3.5" /> {rule.rewardCoins} coins
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {Math.min(value, target)} / {target}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={!completed || alreadyClaimed || claimingId === rule.id}
                  onClick={() => claim(rule.id)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 bg-indigo-600 hover:bg-indigo-500"
                >
                  {alreadyClaimed ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
                  {alreadyClaimed ? 'Claimed' : claimingId === rule.id ? 'Claiming…' : 'Claim reward'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
