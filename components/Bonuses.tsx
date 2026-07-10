import React, { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";
import { useSound } from "../context/SoundContext";
import { DailySpinPage } from "./DailySpinPage";
import { authedFetch } from "../utils/authedFetch";
import { auth } from "../firebase";

export const Bonuses: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { user, setView, isAuthenticated, openAuthModal, bonusSettings, resendEmailVerification } = useGame();
  const { playSound } = useSound();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN)
    ? Number(user.lastDailyClaim)
    : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const nextDailyClaimAt = lastDailyClaim + dailyCooldownMs;
  const canClaim = !lastDailyClaim || nextDailyClaimAt <= currentTime;
  const currentAuthUser = auth.currentUser;
  const isEmailVerificationLocked = Boolean(
    isAuthenticated && currentAuthUser?.email && currentAuthUser.emailVerified === false,
  );

  const handleSpinStart = async () => {
    if (!isAuthenticated) {
      openAuthModal("login");
      throw new Error("Please login to spin.");
    }

    if (isEmailVerificationLocked) {
      throw new Error("Please verify your email before spinning.");
    }

    if (!canClaim) {
      throw new Error("Daily spin is on cooldown.");
    }

    const data = await authedFetch<{ prizeAmount: number }>("/api/daily-spin", {
      method: "POST",
      body: JSON.stringify({ action: "spin" }),
    });

    return {
      amount: Number(data.prizeAmount ?? 0),
    };
  };

  const handleSpinClaim = async () => {
    const data = await authedFetch<{
      prizeAmount: number;
      nextClaimAt: number;
    }>("/api/daily-spin", {
      method: "POST",
      body: JSON.stringify({ action: "claim" }),
    });

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
        isSpinLocked={isEmailVerificationLocked}
        lockedEmail={currentAuthUser?.email ?? undefined}
        onResendVerification={resendEmailVerification}
      />
    </div>
  );
};
