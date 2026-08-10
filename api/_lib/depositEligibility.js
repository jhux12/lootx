const toNonNegativeNumber = (value) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

export const hasUserMadeDeposit = (user = {}) => (
  toNonNegativeNumber(user.depositCount) > 0
  || toNonNegativeNumber(user.totalDepositedCents) > 0
  || toNonNegativeNumber(user.totalSpent) > 0
);

export const requireShipmentDeposit = (user = {}) => {
  if (!hasUserMadeDeposit(user)) {
    throw { status: 403, error: 'DEPOSIT_REQUIRED', message: 'Make your first deposit before requesting shipment.' };
  }
};
