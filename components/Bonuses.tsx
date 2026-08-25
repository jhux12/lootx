import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { DailySpinPage } from "./DailySpinPage";
import { hasUserMadeDeposit } from "../utils/depositEligibility";
import { authedFetch } from "../utils/authedFetch";

export const Bonuses: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { user, boxes, setView, isAuthenticated, openAuthModal, syncBalance } = useGame();
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);
  const [localMissionClaims, setLocalMissionClaims] = useState<Record<string, number>>({});
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const dailyBox = boxes.find((box) => box.isDailyReward) ?? null;
  const hasMadeDeposit = hasUserMadeDeposit(user);
  const lastDailyBoxClaim = Number.isFinite(user.lastDailyRewardBoxClaim ?? NaN)
    ? Number(user.lastDailyRewardBoxClaim)
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
        depositMissionCents={Number(user.depositMissionDepositedCents ?? 0)}
        depositMissionCycleStart={Number(user.depositMissionCycleStart ?? 0)}
        depositMissionClaims={{ ...(user.depositMissionClaims ?? {}), ...localMissionClaims }}
        claimingMissionId={claimingMissionId}
        onClaimDepositMission={async (missionId) => {
          if (!isAuthenticated) { openAuthModal("login"); return; }
          setClaimingMissionId(missionId);
          try {
            const result = await authedFetch<{ newCoins: number; cycleStart: number }>("/api/rewards/claim-deposit-mission", { method: "POST", body: JSON.stringify({ missionId }) });
            syncBalance(result.newCoins);
            setLocalMissionClaims((claims) => ({ ...claims, [missionId]: result.cycleStart }));
          } catch (error) {
            alert((error as Error)?.message || "Unable to claim this deposit mission.");
          } finally { setClaimingMissionId(null); }
        }}
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
