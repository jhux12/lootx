import React from "react";
import { useGame } from "../context/GameContext";
import { DailySpinPage } from "./DailySpinPage";
import { hasUserMadeDeposit } from "../utils/depositEligibility";

export const Bonuses: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { user, boxes, setView, isAuthenticated, openAuthModal } = useGame();
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const dailyBox = boxes.find((box) => box.isDaily) ?? null;
  const hasMadeDeposit = hasUserMadeDeposit(user);
  const lastDailyBoxClaim = Number.isFinite(user.lastFreeBoxClaim ?? NaN)
    ? Number(user.lastFreeBoxClaim)
    : 0;
  const nextDailyBoxClaimAt = lastDailyBoxClaim
    ? lastDailyBoxClaim + dailyCooldownMs
    : 0;
  return (
    <div className={embedded ? "w-full" : "max-w-7xl mx-auto p-4 md:p-6"}>
      <DailySpinPage
        onBack={embedded ? undefined : () => setView({ type: "HOME" })}
        nextClaimAt={nextDailyBoxClaimAt}
        embedded={embedded}
        dailyBox={dailyBox}
        hasMadeDeposit={hasMadeDeposit}
        onOpenDailyBox={() => {
          if (!isAuthenticated) {
            openAuthModal("login");
            return;
          }
          if (dailyBox && hasMadeDeposit && nextDailyBoxClaimAt <= Date.now()) {
            setView({ type: "CASE_OPENING", boxId: dailyBox.id, isFree: true });
          }
        }}
      />
    </div>
  );
};
