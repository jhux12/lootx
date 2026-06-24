export const getProtectedSellBackValue = (item: { firstDepositBuybackProtected?: boolean; protectedSellBackCoins?: number }) => {
  const protectedValue = Number(item.protectedSellBackCoins);
  return item.firstDepositBuybackProtected === true && Number.isFinite(protectedValue) && protectedValue > 0
    ? Math.floor(protectedValue)
    : null;
};

export const getSellBackValue = (price: number, rate: number) => {
  const rawValue = price * rate;
  if (rawValue <= 0) {
    return 0;
  }
  const roundedValue = Math.round(rawValue);
  return Math.min(price, Math.max(1, roundedValue));
};
