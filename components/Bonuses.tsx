import React, { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";
import { useSound } from "../context/SoundContext";
import { DailySpinPage } from "./DailySpinPage";
import { authedFetch } from "../utils/authedFetch";
import { useVisibleInterval } from "../hooks/useVisibleInterval";

const DAILY_SPIN_BALANCE_SUPPRESSION_KEY = "pullzDailySpinSuppressBalanceFeedbackUntil";
const DAILY_SPIN_ANIMATION_MS = 5000;

export const Bonuses: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { user, setView, isAuthenticated, openAuthModal, bonusSettings } = useGame();
  const { playSound } = useSound();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useVisibleInterval(() => setCurrentTime(Date.now()), 1000);

  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN)
    ? Number(user.lastDailyClaim)
    : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const nextDailyClaimAt = lastDailyClaim + dailyCooldownMs;
  const canClaim = !lastDailyClaim || nextDailyClaimAt <= currentTime;


  const handleSpinStart = async () => {
    if (!isAuthenticated) {
      openAuthModal("login");
      throw new Error("Please login to spin.");
    }

    if (!canClaim) {
      throw new Error("Daily spin is on cooldown.");
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        DAILY_SPIN_BALANCE_SUPPRESSION_KEY,
        String(Date.now() + DAILY_SPIN_ANIMATION_MS + 1500),
      );
    }

    try {
      const data = await authedFetch<{ prizeAmount: number; nextClaimAt?: number }>("/api/daily-spin", {
        method: "POST",
        body: JSON.stringify({ action: "spin" }),
      });

      return {
        amount: Number(data.prizeAmount ?? 0),
        nextClaimAt: Number(data.nextClaimAt ?? 0) || undefined,
      };
    } catch (error) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DAILY_SPIN_BALANCE_SUPPRESSION_KEY);
      }
      throw error;
    }
  };

  const handleSpinClaim = async () => {
    const data = await authedFetch<{
      prizeAmount: number;
      nextClaimAt: number;
    }>("/api/daily-spin", {
      method: "POST",
      body: JSON.stringify({ action: "claim" }),
    });

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DAILY_SPIN_BALANCE_SUPPRESSION_KEY);
    }
    playSound("coins");

    return {
      amount: Number(data.prizeAmount ?? 0),
      nextClaimAt: Number(data.nextClaimAt ?? Date.now() + dailyCooldownMs),
    };
  };

  return (
    <div className={embedded ? "w-full" : "max-w-7xl mx-auto p-4 md:p-6"}>
      <DailySpinPage
        onBack={embedded ? undefined : () => setView({ type: "HOME" })}
        onSpinStart={handleSpinStart}
        onSpinClaim={handleSpinClaim}
        onExploreBoxes={() => setView({ type: "BOXES" })}
        canSpin={canClaim}
        nextClaimAt={nextDailyClaimAt}
        embedded={embedded}
        dailySpinOdds={bonusSettings.dailySpinOdds}
      />
    </div>
  );
};
