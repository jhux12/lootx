import type { User } from '../types';

const toNonNegativeNumber = (value: unknown) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

export const getUserDepositSignals = (user: Pick<User, 'depositCount' | 'totalDepositedCents' | 'totalSpent'>) => ({
  depositCount: toNonNegativeNumber(user.depositCount),
  totalDepositedCents: toNonNegativeNumber(user.totalDepositedCents),
  totalSpent: toNonNegativeNumber(user.totalSpent)
});

export const hasUserMadeDeposit = (user: Pick<User, 'depositCount' | 'totalDepositedCents' | 'totalSpent'>) => {
  const { depositCount, totalDepositedCents, totalSpent } = getUserDepositSignals(user);
  return depositCount > 0 || totalDepositedCents > 0 || totalSpent > 0;
};
