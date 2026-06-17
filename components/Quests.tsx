import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, Clock3, Gift, Target } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useGame } from "../context/GameContext";
import { authedFetch } from "../utils/authedFetch";
import {
  getQuestProgressValue,
  normalizeQuestRules,
  QuestProgressStats,
  QuestRule,
} from "../src/lib/quests";

const dayKey = () => new Date().toISOString().slice(0, 10);

const getTimeUntilResetLabel = (nowTs: number) => {
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  const diffMs = Math.max(0, nextReset.getTime() - nowTs);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const Quests: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { user, isAuthenticated, openAuthModal, syncBalance } = useGame();
  const [rules, setRules] = useState<QuestRule[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [locallyClaimedIds, setLocallyClaimedIds] = useState<
    Record<string, string>
  >({});
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const pathLabel = "settings/rewards";
    console.log("READING FIRESTORE PATH", pathLabel);
    const unsub = onSnapshot(
      doc(db, "settings", "rewards"),
      (snap) => {
        console.log("SNAPSHOT OK", {
          path: pathLabel,
          size: "size" in snap ? snap.size : undefined,
        });
        const data = snap.data() as Record<string, unknown> | undefined;
        setRules(normalizeQuestRules(data?.questRules));
      },
      (error) => {
        console.error("SNAPSHOT FAILED", {
          path: pathLabel,
          code: error?.code,
          message: error?.message,
          error,
        });
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const today = dayKey();
  const rawStats = (user as any).challengeStats as
    | QuestProgressStats
    | undefined;
  const claims = ((user as any).questClaims ?? {}) as Record<string, string>;
  const stats =
    (user as any).challengeStatsDay === today ? rawStats : undefined;
  const resetLabel = useMemo(() => getTimeUntilResetLabel(nowTs), [nowTs]);

  const rows = useMemo(
    () =>
      rules
        .filter((rule) => rule.enabled !== false)
        .map((rule) => {
          const value = getQuestProgressValue(rule, stats ?? {});
          const target = Math.max(1, rule.target);
          const completed = value >= target;
          const alreadyClaimed =
            claims?.[rule.id] === today ||
            locallyClaimedIds?.[rule.id] === today;
          return { rule, value, target, completed, alreadyClaimed };
        }),
    [claims, locallyClaimedIds, rules, stats, today],
  );

  const claim = async (questId: string) => {
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    setClaimingId(questId);
    try {
      const result = await authedFetch<{
        newCoins?: number;
        rewardCoins?: number;
      }>("/api/rewards/claim-quest", {
        method: "POST",
        body: JSON.stringify({ questId }),
      });
      if (typeof result?.newCoins === "number") {
        syncBalance(result.newCoins);
      }
      setLocallyClaimedIds((prev) => ({ ...prev, [questId]: today }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pullz:quest-claimed", {
            detail: { questId, day: today },
          }),
        );
      }
    } catch (error) {
      console.error("Failed to claim quest reward", error);
      alert("Could not claim quest reward right now.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <section
      className={
        embedded
          ? "w-full"
          : "mx-auto w-full max-w-5xl px-4 pb-8 pt-6 sm:px-6 lg:px-8"
      }
    >
      {!embedded ? (
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      ) : null}
      <div className="mb-5 rounded-2xl border border-white/10 bg-[#161b1f] p-4 sm:p-6">
        <h1 className="text-xl font-extrabold text-white sm:text-2xl">
          Mini Challenges / Quests
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          Complete 3 actions today for bonus rewards.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 sm:text-sm">
          <Clock3 className="h-3.5 w-3.5" />
          Missions reset in{" "}
          <span className="font-extrabold tracking-wide">{resetLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {rows.map(({ rule, value, target, completed, alreadyClaimed }) => {
          const progress = Math.min(100, Math.round((value / target) * 100));
          const disabled =
            !completed || alreadyClaimed || claimingId === rule.id;
          return (
            <article
              key={rule.id}
              className="rounded-2xl border border-white/10 bg-[#161b1f] p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-cyan-200 sm:text-base">
                    {rule.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 sm:text-sm">
                    {rule.description ||
                      "Complete this mission to claim your reward."}
                  </p>
                </div>
                <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">
                  <Gift className="h-3.5 w-3.5" /> {rule.rewardCoins} coins
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" /> {Math.min(value, target)}{" "}
                    / {target}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#205DD7] to-sky-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                {alreadyClaimed ? (
                  <p className="text-xs font-semibold text-emerald-300">
                    Claimed — resets in {resetLabel}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => claim(rule.id)}
                  className={`inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${disabled ? "cursor-not-allowed border border-white/10 bg-white/5 text-gray-400" : "bg-[#205DD7] text-white hover:bg-[#1f6bea]"}`}
                >
                  {alreadyClaimed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  ) : null}
                  {alreadyClaimed
                    ? "Claimed"
                    : claimingId === rule.id
                      ? "Claiming…"
                      : "Claim reward"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
