const toNonNegativeNumber = (value) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

// Keep this in sync with utils/depositEligibility.ts, which controls first-deposit offers.
export const hasUserMadeDeposit = (user = {}) => (
  toNonNegativeNumber(user.depositCount) > 0
  || toNonNegativeNumber(user.totalDepositedCents) > 0
  || toNonNegativeNumber(user.totalSpent) > 0
);
