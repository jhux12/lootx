import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { DailySpinPage } from "./DailySpinPage";
import { authedFetch } from "../utils/authedFetch";
import { useVisibleInterval } from "../hooks/useVisibleInterval";

export const Bonuses: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { user, setView, isAuthenticated, openAuthModal, bonusSettings } = useGame();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useVisibleInterval(() => setCurrentTime(Date.now()), 1000);

  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN)
    ? Number(user.lastDailyClaim)
    : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const nextDailyClaimAt = lastDailyClaim + dailyCooldownMs;
  const canClaim = !lastDailyClaim || nextDailyClaimAt <= currentTime;


  const handleClaim = async () => {
    if (!isAuthenticated) {
      openAuthModal("login");
      throw new Error("Log in to open your daily box.");
    }

    if (!canClaim) {
      throw new Error("Your next daily box is not ready yet.");
    }

    const data = await authedFetch<{
      prizeAmount: number;
      nextClaimAt: number;
    }>("/api/daily-spin", {
      method: "POST",
      body: JSON.stringify({ action: "open" }),
    });
    return {
      amount: Number(data.prizeAmount ?? 0),
      nextClaimAt: Number(data.nextClaimAt ?? Date.now() + dailyCooldownMs),
    };
  };

  return (
    <div className={embedded ? "w-full" : "max-w-7xl mx-auto p-4 md:p-6"}>
      <DailySpinPage
        onBack={embedded ? undefined : () => setView({ type: "HOME" })}
        onClaim={handleClaim}
        onExploreBoxes={() => setView({ type: "BOXES" })}
        canSpin={canClaim}
        nextClaimAt={nextDailyClaimAt}
        embedded={embedded}
        tiers={bonusSettings.dailyRewardTiers}
        totalSpent={Number(user.totalSpent ?? 0)}
        hasDeposited={Number(user.depositCount ?? 0) > 0 || Number(user.totalDepositedCents ?? 0) > 0 || Number(user.totalSpent ?? 0) > 0}
      />
    </div>
  );
};
